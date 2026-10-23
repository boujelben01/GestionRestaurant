using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Admin;

public class CommandeAdminService(AppDbContext db, TimeProvider time)
{
    public const int MaxPageSize = 50;
    public const int MaxActives = 200;
    public const int MaxSearchLength = 100;

    private static readonly StatutCommande[] ActiveStatuts =
        [StatutCommande.EnAttente, StatutCommande.EnPreparation, StatutCommande.Prete];

    public async Task<PagedResult<CommandeAdminResumeResponse>> ListAsync(
        IReadOnlyCollection<string>? statut,
        string? typeCommande,
        bool? estPayee,
        string? du,
        string? au,
        string? recherche,
        int page,
        int pageSize,
        CancellationToken ct)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var statuts = ParseStatuts(statut);
        var type = string.IsNullOrWhiteSpace(typeCommande) ? (TypeCommande?)null : ParseEnum<TypeCommande>(typeCommande, "typeCommande");
        var from = ParseBound(du, "du");
        var to = ParseBound(au, "au");
        if (from is not null && to is not null && from.Value.Utc > to.Value.Utc)
        {
            throw AppException.Invalid("du", "La date de début doit précéder la date de fin.");
        }

        var query = db.Commandes.AsNoTracking();
        if (statuts.Count > 0)
        {
            query = query.Where(c => statuts.Contains(c.Statut));
        }

        if (type is { } t)
        {
            query = query.Where(c => c.TypeCommande == t);
        }

        if (estPayee is { } paid)
        {
            query = query.Where(c => c.EstPayee == paid);
        }

        if (from is { } start)
        {
            var startUtc = start.Utc;
            query = query.Where(c => c.DateCommande >= startUtc);
        }

        if (to is { } end)
        {
            var endUtc = end.Utc;
            // Date seule (« 2024-06-30 ») : tout le jour inclus, donc borne exclusive au lendemain 00:00 UTC.
            query = end.IsDateOnly
                ? query.Where(c => c.DateCommande < endUtc.AddDays(1))
                : query.Where(c => c.DateCommande <= endUtc);
        }

        if (!string.IsNullOrWhiteSpace(recherche))
        {
            var term = recherche.Trim();
            if (term.Length > MaxSearchLength)
            {
                throw AppException.Invalid("recherche", $"La recherche ne peut pas dépasser {MaxSearchLength} caractères.");
            }

            term = term.ToLowerInvariant();
            query = query.Where(c =>
                c.Numero.ToLower().Contains(term) ||
                c.NomClient.ToLower().Contains(term) ||
                c.Telephone.ToLower().Contains(term));
        }

        var total = await query.CountAsync(ct);
        var rows = await query
            .OrderByDescending(c => c.DateCommande).ThenByDescending(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new
            {
                c.Id, c.Numero, c.Statut, c.TypeCommande, c.NomClient, c.Telephone,
                TableNumero = c.Table != null ? (int?)c.Table.Numero : null,
                c.Total, c.EstPayee, c.DateCommande, c.DateMiseAJour,
                NombreArticles = c.Items.Sum(i => i.Quantite)
            })
            .ToListAsync(ct);

        var items = rows.Select(c => new CommandeAdminResumeResponse(
            c.Id, c.Numero, c.Statut, c.TypeCommande, c.NomClient, c.Telephone, c.TableNumero,
            c.Total, c.EstPayee, c.NombreArticles, AsUtc(c.DateCommande), AsUtc(c.DateMiseAJour))).ToList();
        return new PagedResult<CommandeAdminResumeResponse>(items, page, pageSize, total);
    }

    public async Task<CommandeAdminResponse> GetAsync(int id, CancellationToken ct)
    {
        var c = await db.Commandes.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new
            {
                x.Id, x.Numero, x.Statut, x.TypeCommande, x.ModePaiement, x.EstPayee,
                x.SousTotal, x.FraisLivraison, x.Total, x.Note, x.AdresseLivraison,
                TableNumero = x.Table != null ? (int?)x.Table.Numero : null,
                x.UserId, x.NomClient, x.Telephone, x.DateCommande, x.DateMiseAJour, x.Version
            })
            .FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Commande introuvable.");

        var lignes = await db.CommandeItems.AsNoTracking()
            .Where(i => i.CommandeId == id)
            .OrderBy(i => i.Id)
            .Select(i => new { i.ArticleId, i.NomFr, i.NomAr, i.PrixUnitaire, i.Quantite })
            .ToListAsync(ct);

        // Projection ciblée : seuls l'identifiant et le nom d'affichage de l'auteur sortent de la base
        // (jamais l'entité utilisateur, donc ni hash de mot de passe ni security stamp).
        var historique = await db.HistoriqueStatuts.AsNoTracking()
            .Where(h => h.CommandeId == id)
            .OrderBy(h => h.Date).ThenBy(h => h.Id)
            .Select(h => new
            {
                h.Statut, h.Date, h.ParUserId,
                ParNom = h.ParUser != null ? (h.ParUser.Nom ?? h.ParUser.UserName) : null
            })
            .ToListAsync(ct);

        return new CommandeAdminResponse(
            c.Id, c.Numero, c.Statut, StatutTransitions.NextOf(c.Statut), c.TypeCommande, c.ModePaiement, c.EstPayee,
            c.SousTotal, c.FraisLivraison, c.Total, c.Note, c.AdresseLivraison, c.TableNumero,
            new CommandeAdminClientResponse(c.UserId, c.NomClient, c.Telephone),
            AsUtc(c.DateCommande), AsUtc(c.DateMiseAJour),
            lignes.Select(l => new CommandeAdminLigneResponse(
                l.ArticleId, l.NomFr, l.NomAr, l.PrixUnitaire, l.Quantite, CommandeRules.Round(l.PrixUnitaire * l.Quantite))).ToList(),
            historique.Select(h => new CommandeAdminHistoriqueResponse(h.Statut, AsUtc(h.Date), h.ParUserId, h.ParNom)).ToList(),
            c.Version);
    }

    public async Task<IReadOnlyList<CommandeActiveResponse>> ActivesAsync(CancellationToken ct)
    {
        var rows = await db.Commandes.AsNoTracking()
            .Where(c => ActiveStatuts.Contains(c.Statut))
            .OrderBy(c => c.DateCommande).ThenBy(c => c.Id)
            .Take(MaxActives)
            .Select(c => new
            {
                c.Id, c.Numero, c.Statut, c.TypeCommande, c.NomClient,
                TableNumero = c.Table != null ? (int?)c.Table.Numero : null,
                c.Note, c.DateCommande, c.DateMiseAJour, c.Version,
                Lignes = c.Items.OrderBy(i => i.Id).Select(i => new { i.NomFr, i.NomAr, i.Quantite }).ToList()
            })
            .ToListAsync(ct);

        return rows.Select(c => new CommandeActiveResponse(
            c.Id, c.Numero, c.Statut, c.TypeCommande, c.NomClient, c.TableNumero, c.Note,
            AsUtc(c.DateCommande), AsUtc(c.DateMiseAJour),
            c.Lignes.Select(l => new CommandeActiveLigneResponse(l.NomFr, l.NomAr, l.Quantite)).ToList(),
            c.Version)).ToList();
    }

    public async Task<CommandesCompteursResponse> CompteursAsync(CancellationToken ct)
    {
        var (date, startUtc, endUtc) = TunisDay.Bounds(time.GetUtcNow());

        var counts = await db.Commandes.AsNoTracking()
            .Where(c => c.DateCommande >= startUtc && c.DateCommande < endUtc)
            .GroupBy(c => c.Statut)
            .Select(g => new { Statut = g.Key, Nombre = g.Count() })
            .ToListAsync(ct);
        var enAttente = await db.Commandes.AsNoTracking().CountAsync(c => c.Statut == StatutCommande.EnAttente, ct);

        // Un compteur par statut, y compris à 0, dans l'ordre du cycle de vie (ordre de l'énumération).
        var parStatut = Enum.GetValues<StatutCommande>()
            .Select(s => new CompteurStatutResponse(s, counts.FirstOrDefault(c => c.Statut == s)?.Nombre ?? 0))
            .ToList();
        return new CommandesCompteursResponse(date, parStatut, parStatut.Sum(c => c.Nombre), enAttente);
    }

    public async Task<CommandeAdminResponse> ChangerStatutAsync(
        string adminId, int id, StatutCommande cible, uint? version, CancellationToken ct)
    {
        var commande = await db.Commandes.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Commande introuvable.");

        // Idempotence : le statut demandé est déjà le bon → 200, aucun doublon d'historique.
        if (StatutTransitions.Evaluate(commande.Statut, cible) == TransitionKind.Unchanged)
        {
            return await GetAsync(id, ct);
        }

        if (version is { } expected && expected != commande.Version)
        {
            throw AppException.Conflict("La commande a été modifiée entre-temps. Rechargez-la et réessayez.");
        }

        StatutTransitions.EnsureAllowed(commande.Statut, cible);

        var now = time.GetUtcNow().UtcDateTime;
        commande.Statut = cible;
        commande.DateMiseAJour = now;
        db.HistoriqueStatuts.Add(new HistoriqueStatut
        {
            CommandeId = commande.Id,
            Statut = cible,
            Date = now,
            ParUserId = adminId
        });

        // xmin (jeton de concurrence) : une écriture concurrente entre la lecture et celle-ci lève
        // DbUpdateConcurrencyException, traduite en 409 par GlobalExceptionHandler.
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<CommandeAdminResponse> SetPaiementAsync(int id, bool estPayee, CancellationToken ct)
    {
        var commande = await db.Commandes.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Commande introuvable.");

        if (commande.Statut == StatutCommande.Annulee)
        {
            throw AppException.Conflict("Le paiement d'une commande annulée ne peut pas être modifié.");
        }

        if (commande.EstPayee != estPayee)
        {
            commande.EstPayee = estPayee;
            commande.DateMiseAJour = time.GetUtcNow().UtcDateTime;
            await db.SaveChangesAsync(ct);
        }

        return await GetAsync(id, ct);
    }

    // --- Analyse des filtres : toute saisie invalide donne un 400, jamais un 500 ---

    private static List<StatutCommande> ParseStatuts(IReadOnlyCollection<string>? values)
    {
        var result = new List<StatutCommande>();
        foreach (var raw in values ?? [])
        {
            foreach (var part in raw.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            {
                var statut = ParseEnum<StatutCommande>(part, "statut");
                if (!result.Contains(statut))
                {
                    result.Add(statut);
                }
            }
        }

        return result;
    }

    /// <summary>Accepte uniquement les noms (insensible à la casse) : ni nombres ni combinaisons de drapeaux.</summary>
    private static T ParseEnum<T>(string value, string field) where T : struct, Enum
    {
        var text = value.Trim();
        if (text.Length is 0 or > 30 || !text.All(char.IsLetter) || !Enum.TryParse<T>(text, true, out var parsed) || !Enum.IsDefined(parsed))
        {
            throw AppException.Invalid(field, $"Valeur invalide. Valeurs possibles : {string.Join(", ", Enum.GetNames<T>())}.");
        }

        return parsed;
    }

    private readonly record struct Bound(DateTime Utc, bool IsDateOnly);

    /// <summary>« 2024-06-30 » (jour UTC entier) ou date-heure ISO 8601 (« 2024-06-30T10:00:00Z », UTC si sans fuseau).</summary>
    private static Bound? ParseBound(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var text = value.Trim();
        if (DateOnly.TryParseExact(text, "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day))
        {
            return new Bound(day.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc), true);
        }

        if (text.Length <= 40 && DateTimeOffset.TryParse(
                text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var moment))
        {
            return new Bound(moment.UtcDateTime, false);
        }

        throw AppException.Invalid(field, "Date invalide : utilisez AAAA-MM-JJ ou une date-heure ISO 8601 (UTC).");
    }

    private static DateTime AsUtc(DateTime value) => DateTime.SpecifyKind(value, DateTimeKind.Utc);
}
