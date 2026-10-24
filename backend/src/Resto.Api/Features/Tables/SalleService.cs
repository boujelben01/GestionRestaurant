using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes;

namespace Resto.Api.Features.Tables;

/// <summary>
/// Plan de salle : état de chaque table calculé à partir de ses commandes SurPlace, et actions
/// « encaisser » / « libérer ». Aucun état n'est stocké : tout se déduit des commandes.
/// </summary>
public class SalleService(AppDbContext db, TimeProvider time)
{
    // --- Règles pures (testées sans base) ---

    /// <summary>Commande à suivre sur une table : ni annulée, ni terminée-et-payée.</summary>
    public static bool IsTracked(StatutCommande statut, bool estPayee) =>
        statut != StatutCommande.Annulee && !(statut == StatutCommande.Terminee && estPayee);

    public static bool IsInProgress(StatutCommande statut) =>
        statut is StatutCommande.EnAttente or StatutCommande.EnPreparation or StatutCommande.Prete;

    /// <summary>État d'une table à partir de ses commandes à suivre (déjà filtrées par <see cref="IsTracked"/>).</summary>
    public static EtatTable ComputeEtat(bool estActive, IEnumerable<(StatutCommande Statut, bool EstPayee)> tracked)
    {
        if (!estActive)
        {
            return EtatTable.Inactive;
        }

        var list = tracked.ToList();
        if (list.Any(c => IsInProgress(c.Statut)))
        {
            return EtatTable.Occupee;
        }

        return list.Any(c => !c.EstPayee) ? EtatTable.AEncaisser : EtatTable.Libre;
    }

    // --- Requêtes (internal static) : isolées pour SqlTranslationTests (voir CommandeAdminService) ---

    internal sealed record SalleOrderRow
    {
        public int TableId { get; init; }
        public int Id { get; init; }
        public string Numero { get; init; } = string.Empty;
        public StatutCommande Statut { get; init; }
        public decimal Total { get; init; }
        public bool EstPayee { get; init; }
        public DateTime DateCommande { get; init; }
    }

    /// <summary>
    /// UNE requête pour toute la salle : les commandes SurPlace à suivre de toutes les tables, en colonnes
    /// simples (filtre avant projection, aucune sous-requête agrégée). L'agrégation se fait en mémoire :
    /// pas de N+1.
    /// </summary>
    internal static IQueryable<SalleOrderRow> TrackedOrdersQuery(AppDbContext db, int? tableId = null) =>
        db.Commandes.AsNoTracking()
            .Where(c => c.TypeCommande == TypeCommande.SurPlace
                        && c.TableId != null
                        && c.Statut != StatutCommande.Annulee
                        && !(c.Statut == StatutCommande.Terminee && c.EstPayee)
                        && (tableId == null || c.TableId == tableId))
            .OrderBy(c => c.DateCommande).ThenBy(c => c.Id)
            .Select(c => new SalleOrderRow
            {
                TableId = c.TableId!.Value,
                Id = c.Id,
                Numero = c.Numero,
                Statut = c.Statut,
                Total = c.Total,
                EstPayee = c.EstPayee,
                DateCommande = c.DateCommande
            });

    // --- Lecture ---

    public async Task<IReadOnlyList<SalleTableResponse>> SalleAsync(CancellationToken ct)
    {
        var tables = await TableAdminService.ListQuery(db).ToListAsync(ct);
        var orders = await TrackedOrdersQuery(db).ToListAsync(ct);
        var byTable = orders.ToLookup(o => o.TableId);
        return tables.Select(t => Build(t, byTable[t.Id].ToList())).ToList();
    }

    private async Task<SalleTableResponse> BuildOneAsync(RestaurantTable table, CancellationToken ct) =>
        Build(table, await TrackedOrdersQuery(db, table.Id).ToListAsync(ct));

    private static SalleTableResponse Build(RestaurantTable table, IReadOnlyList<SalleOrderRow> orders)
    {
        var unpaid = orders.Where(o => !o.EstPayee).ToList();
        return new SalleTableResponse(
            table.Id,
            table.Numero,
            table.Capacite,
            table.EstActive,
            ComputeEtat(table.EstActive, orders.Select(o => (o.Statut, o.EstPayee))),
            unpaid.Sum(o => o.Total),
            orders.Count,
            orders.Count == 0 ? null : AsUtc(orders.Min(o => o.DateCommande)),
            orders.Select(o => new SalleCommandeResponse(o.Id, o.Numero, o.Statut, o.Total, o.EstPayee, AsUtc(o.DateCommande))).ToList());
    }

    // --- Actions ---

    /// <summary>
    /// Marque payées toutes les commandes non payées et non annulées de la table (l'historique des statuts ne
    /// change pas). 409 s'il n'y a rien à encaisser : un second appel immédiat renvoie donc 409 (aucun effet).
    /// </summary>
    public async Task<SalleTableResponse> EncaisserAsync(int id, CancellationToken ct)
    {
        var table = await FindTableAsync(id, ct);
        var unpaid = await db.Commandes
            .Where(c => c.TableId == id && c.TypeCommande == TypeCommande.SurPlace
                        && c.Statut != StatutCommande.Annulee && !c.EstPayee)
            .ToListAsync(ct);
        if (unpaid.Count == 0)
        {
            throw AppException.Conflict($"La table n° {table.Numero} n'a rien à encaisser.");
        }

        var now = time.GetUtcNow().UtcDateTime;
        foreach (var commande in unpaid)
        {
            commande.EstPayee = true;
            commande.DateMiseAJour = now;
        }

        // xmin : une commande modifiée entre-temps (annulation, changement de statut) lève
        // DbUpdateConcurrencyException, traduite en 409 par GlobalExceptionHandler.
        await db.SaveChangesAsync(ct);
        return await BuildOneAsync(table, ct);
    }

    /// <summary>
    /// Libère la table : tout doit être payé et plus rien ne doit être en attente ou en préparation. Les commandes
    /// encore « Prete » passent alors en « Terminee » (historique + auteur, via StatutTransitions). Sur une table déjà
    /// libre, ne fait rien (200).
    /// </summary>
    public async Task<SalleTableResponse> LibererAsync(string adminId, int id, CancellationToken ct)
    {
        var table = await FindTableAsync(id, ct);
        var tracked = await db.Commandes
            .Where(c => c.TableId == id && c.TypeCommande == TypeCommande.SurPlace
                        && c.Statut != StatutCommande.Annulee
                        && !(c.Statut == StatutCommande.Terminee && c.EstPayee))
            .ToListAsync(ct);

        var enCours = tracked.Count(c => c.Statut is StatutCommande.EnAttente or StatutCommande.EnPreparation);
        var nonPayees = tracked.Count(c => !c.EstPayee);
        if (enCours > 0 || nonPayees > 0)
        {
            var reasons = new List<string>();
            if (enCours > 0)
            {
                reasons.Add($"{enCours} commande(s) en attente ou en préparation (terminez-les ou annulez-les d'abord)");
            }

            if (nonPayees > 0)
            {
                reasons.Add($"{nonPayees} commande(s) non encaissée(s) (encaissez d'abord)");
            }

            throw AppException.Conflict($"Impossible de libérer la table n° {table.Numero} : {string.Join(" ; ", reasons)}.");
        }

        var now = time.GetUtcNow().UtcDateTime;
        foreach (var commande in tracked.Where(c => c.Statut == StatutCommande.Prete))
        {
            StatutTransitions.EnsureAllowed(commande.Statut, StatutCommande.Terminee);
            commande.Statut = StatutCommande.Terminee;
            commande.DateMiseAJour = now;
            db.HistoriqueStatuts.Add(new HistoriqueStatut
            {
                CommandeId = commande.Id,
                Statut = StatutCommande.Terminee,
                Date = now,
                ParUserId = adminId
            });
        }

        // Limite connue : xmin protège les commandes DÉJÀ lues ; une commande créée sur cette table entre la
        // lecture et l'écriture n'est pas détectée (elle restera simplement « Occupee » au prochain relevé).
        await db.SaveChangesAsync(ct);
        return await BuildOneAsync(table, ct);
    }

    private async Task<RestaurantTable> FindTableAsync(int id, CancellationToken ct) =>
        await db.Tables.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("Table introuvable.");

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
