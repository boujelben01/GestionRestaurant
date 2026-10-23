using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes.Contracts;
using Resto.Api.Features.Panier;
using Resto.Api.Features.Restaurant;

namespace Resto.Api.Features.Commandes;

public class CommandeService(AppDbContext db, TimeProvider time)
{
    public const int MaxPageSize = 50;
    private const int NomClientMax = 100;

    public async Task<CommandeResponse> CreerAsync(string userId, CreerCommandeRequest request, CancellationToken ct)
    {
        var type = request.TypeCommande!.Value;
        var adresse = CommandeRules.Clean(request.AdresseLivraison);
        var note = CommandeRules.Clean(request.Note);
        CommandeRules.ValidateShape(type, adresse, request.TableCode);

        var parametres = await db.ParametresRestaurant.AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw AppException.Conflict("Le restaurant n'est pas encore configuré.");
        if (!parametres.CommandesOuvertes)
        {
            throw AppException.Conflict("La prise de commandes est fermée pour le moment.");
        }

        var horaires = await db.Horaires.AsNoTracking().ToListAsync(ct);
        if (!OpeningHours.IsOpen(horaires, time.GetUtcNow()))
        {
            throw AppException.Conflict("Le restaurant est actuellement fermé.");
        }

        RestaurantTable? table = null;
        if (type == TypeCommande.SurPlace)
        {
            table = await db.Tables.AsNoTracking().FirstOrDefaultAsync(t => t.Code == request.TableCode && t.EstActive, ct)
                ?? throw AppException.Invalid("TableCode", "Table inconnue ou inactive.");
        }

        // EnableRetryOnFailure impose de passer par la stratégie d'exécution pour toute transaction utilisateur.
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);

            // Anti-doublon : le verrou sur la ligne du panier sérialise les créations de commande d'un même
            // utilisateur. La requête perdante lit un panier déjà vidé par la gagnante et reçoit « panier vide ».
            if (db.Database.IsRelational())
            {
                await db.Database.ExecuteSqlInterpolatedAsync(
                    $"""SELECT "Id" FROM "Paniers" WHERE "UserId" = {userId} FOR UPDATE""", ct);
            }

            var panier = await db.Paniers.FirstOrDefaultAsync(p => p.UserId == userId, ct);
            var items = panier is null
                ? []
                : await db.PanierItems
                    .Include(i => i.Article).ThenInclude(a => a.Categorie)
                    .Where(i => i.PanierId == panier.Id)
                    .OrderBy(i => i.Id)
                    .ToListAsync(ct);
            if (panier is null || items.Count == 0)
            {
                throw AppException.Invalid("Panier", "Votre panier est vide.");
            }

            var bloques = items.Where(i => ArticleAvailability.Of(i.Article) != ArticleStatus.Ok)
                .Select(i => i.Article.NomFr).ToList();
            if (bloques.Count > 0)
            {
                throw AppException.Conflict(
                    $"Ces articles ne sont plus disponibles : {string.Join(", ", bloques)}. Retirez-les de votre panier.");
            }

            var totals = CommandeRules.ComputeTotals(
                items.Select(i => (i.Article.Prix, i.Quantite)), type, parametres.FraisLivraison, parametres.MontantMinimumLivraison);

            var user = await db.Users.AsNoTracking().FirstAsync(u => u.Id == userId, ct);
            var now = time.GetUtcNow().UtcDateTime;

            var commande = new Commande
            {
                Numero = "TMP-" + Guid.NewGuid().ToString("N")[..16],
                UserId = userId,
                NomClient = Truncate(CommandeRules.Clean(user.Nom) ?? user.UserName ?? "Client", NomClientMax),
                Telephone = request.Telephone.Trim(),
                Statut = StatutCommande.EnAttente,
                TypeCommande = type,
                ModePaiement = ModePaiement.Especes,
                EstPayee = false,
                SousTotal = totals.SousTotal,
                FraisLivraison = totals.FraisLivraison,
                Total = totals.Total,
                TableId = table?.Id,
                AdresseLivraison = adresse,
                Note = note,
                DateCommande = now,
                DateMiseAJour = now,
                Items = items.Select(i => new CommandeItem
                {
                    ArticleId = i.ArticleId,
                    NomFr = i.Article.NomFr,
                    NomAr = i.Article.NomAr,
                    PrixUnitaire = i.Article.Prix,
                    Quantite = i.Quantite
                }).ToList(),
                Historique = [new HistoriqueStatut { Statut = StatutCommande.EnAttente, Date = now, ParUserId = userId }]
            };

            db.Commandes.Add(commande);
            await db.SaveChangesAsync(ct);

            commande.Numero = $"CMD-{commande.Id:D6}";
            db.PanierItems.RemoveRange(items);
            panier.DateMiseAJour = now;
            await db.SaveChangesAsync(ct);

            await transaction.CommitAsync(ct);
            return ToResponse(commande, table?.Numero);
        });
    }

    public async Task<PagedResult<CommandeResumeResponse>> ListAsync(string userId, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = db.Commandes.AsNoTracking().Where(c => c.UserId == userId);
        var total = await query.CountAsync(ct);
        var commandes = await query
            .OrderByDescending(c => c.DateCommande).ThenByDescending(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id, c.Numero, c.Statut, c.TypeCommande, c.Total, c.DateCommande,
                NombreArticles = c.Items.Sum(i => i.Quantite)
            })
            .ToListAsync(ct);

        var items = commandes.Select(c => new CommandeResumeResponse(
            c.Id, c.Numero, c.Statut, c.TypeCommande, c.Total, c.NombreArticles, AsUtc(c.DateCommande))).ToList();
        return new PagedResult<CommandeResumeResponse>(items, page, pageSize, total);
    }

    public async Task<CommandeResponse> GetAsync(string userId, int id, CancellationToken ct)
    {
        var commande = await db.Commandes.AsNoTracking()
            .Include(c => c.Items).Include(c => c.Historique).Include(c => c.Table)
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct)
            ?? throw AppException.NotFound("Commande introuvable.");
        return ToResponse(commande, commande.Table?.Numero);
    }

    public async Task<CommandeResponse> AnnulerAsync(string userId, int id, CancellationToken ct)
    {
        var commande = await db.Commandes.FirstOrDefaultAsync(c => c.Id == id && c.UserId == userId, ct)
            ?? throw AppException.NotFound("Commande introuvable.");

        // Même moteur de règles que l'administration (StatutTransitions) ; le client, lui, ne peut annuler
        // qu'une commande encore en attente.
        if (!StatutTransitions.CanClientCancel(commande.Statut))
        {
            throw AppException.Conflict("Seule une commande en attente peut être annulée.");
        }

        var now = time.GetUtcNow().UtcDateTime;
        commande.Statut = StatutCommande.Annulee;
        commande.DateMiseAJour = now;
        db.HistoriqueStatuts.Add(new HistoriqueStatut
        {
            CommandeId = commande.Id,
            Statut = StatutCommande.Annulee,
            Date = now,
            ParUserId = userId
        });

        // xmin : une modification concurrente lève DbUpdateConcurrencyException, traduite en 409 par le handler global.
        await db.SaveChangesAsync(ct);
        return await GetAsync(userId, id, ct);
    }

    public async Task<TableResponse> GetTableAsync(Guid code, CancellationToken ct)
    {
        var numero = await db.Tables.AsNoTracking()
            .Where(t => t.Code == code && t.EstActive)
            .Select(t => (int?)t.Numero)
            .FirstOrDefaultAsync(ct);
        return numero is null ? throw AppException.NotFound("Table introuvable.") : new TableResponse(numero.Value);
    }

    private static CommandeResponse ToResponse(Commande c, int? tableNumero) => new(
        c.Id,
        c.Numero,
        c.Statut,
        c.TypeCommande,
        c.ModePaiement,
        c.EstPayee,
        c.SousTotal,
        c.FraisLivraison,
        c.Total,
        c.Note,
        c.AdresseLivraison,
        tableNumero,
        AsUtc(c.DateCommande),
        c.Items.OrderBy(i => i.Id)
            .Select(i => new CommandeLigneResponse(
                i.ArticleId, i.NomFr, i.NomAr, i.PrixUnitaire, i.Quantite, CommandeRules.Round(i.PrixUnitaire * i.Quantite)))
            .ToList(),
        c.Historique.OrderBy(h => h.Date).ThenBy(h => h.Id)
            .Select(h => new HistoriqueStatutResponse(h.Statut, AsUtc(h.Date)))
            .ToList());

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];
}
