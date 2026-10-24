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

        var from = ParseBound(du, "du");
        var to = ParseBound(au, "au");
        if (from is not null && to is not null && from.Value.Utc > to.Value.Utc)
        {
            throw AppException.Invalid("du", "La date de début doit précéder la date de fin.");
        }

        string? term = null;
        if (!string.IsNullOrWhiteSpace(recherche))
        {
            term = recherche.Trim();
            if (term.Length > MaxSearchLength)
            {
                throw AppException.Invalid("recherche", $"La recherche ne peut pas dépasser {MaxSearchLength} caractères.");
            }

            term = term.ToLowerInvariant();
        }

        var filters = new ListFilters(
            ParseStatuts(statut),
            string.IsNullOrWhiteSpace(typeCommande) ? null : ParseEnum<TypeCommande>(typeCommande, "typeCommande"),
            estPayee,
            from,
            to,
            term);

        var query = ApplyFilters(db.Commandes.AsNoTracking(), filters);
        var total = await query.CountAsync(ct);
        var rows = await SummaryQuery(query, page, pageSize).ToListAsync(ct);

        var items = rows.Select(c => new CommandeAdminResumeResponse(
            c.Id, c.Numero, c.Statut, c.TypeCommande, c.NomClient, c.Telephone, c.TableNumero,
            c.Total, c.EstPayee, c.NombreArticles, AsUtc(c.DateCommande), AsUtc(c.DateMiseAJour))).ToList();
        return new PagedResult<CommandeAdminResumeResponse>(items, page, pageSize, total);
    }

    public async Task<CommandeAdminResponse> GetAsync(int id, CancellationToken ct)
    {
        var c = await DetailQuery(db, id).FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Commande introuvable.");
        var lignes = await LignesQuery(db, id).ToListAsync(ct);
        var historique = await HistoriqueQuery(db, id).ToListAsync(ct);

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
        var rows = await ActivesQuery(db).ToListAsync(ct);

        return rows.Select(c => new CommandeActiveResponse(
            c.Id, c.Numero, c.Statut, c.TypeCommande, c.NomClient, c.TableNumero, c.Note,
            AsUtc(c.DateCommande), AsUtc(c.DateMiseAJour),
            c.Lignes.Select(l => new CommandeActiveLigneResponse(l.NomFr, l.NomAr, l.Quantite)).ToList(),
            c.Version)).ToList();
    }

    public async Task<CommandesCompteursResponse> CompteursAsync(CancellationToken ct)
    {
        var (date, startUtc, endUtc) = TunisDay.Bounds(time.GetUtcNow());

        var counts = await CountersQuery(db, startUtc, endUtc).ToListAsync(ct);
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

    // ---------------------------------------------------------------------------------------------
    // Requêtes (internal static) : isolées pour que SqlTranslationTests vérifie, avec le fournisseur
    // Npgsql et sans connexion, qu'elles se traduisent en SQL PostgreSQL. EF InMemory (utilisé par les
    // tests d'intégration) accepte des expressions que Npgsql refuse : un 500 n'apparaîtrait alors qu'en
    // production. Règle : filtrer et trier AVANT de projeter.
    // ---------------------------------------------------------------------------------------------

    internal sealed record ListFilters(
        IReadOnlyList<StatutCommande> Statuts, TypeCommande? Type, bool? EstPayee, Bound? From, Bound? To, string? Term);

    internal readonly record struct Bound(DateTime Utc, bool IsDateOnly);

    internal sealed record SummaryRow
    {
        public int Id { get; init; }
        public string Numero { get; init; } = string.Empty;
        public StatutCommande Statut { get; init; }
        public TypeCommande TypeCommande { get; init; }
        public string NomClient { get; init; } = string.Empty;
        public string Telephone { get; init; } = string.Empty;
        public int? TableNumero { get; init; }
        public decimal Total { get; init; }
        public bool EstPayee { get; init; }
        public int NombreArticles { get; init; }
        public DateTime DateCommande { get; init; }
        public DateTime DateMiseAJour { get; init; }
    }

    internal sealed record DetailRow
    {
        public int Id { get; init; }
        public string Numero { get; init; } = string.Empty;
        public StatutCommande Statut { get; init; }
        public TypeCommande TypeCommande { get; init; }
        public ModePaiement ModePaiement { get; init; }
        public bool EstPayee { get; init; }
        public decimal SousTotal { get; init; }
        public decimal FraisLivraison { get; init; }
        public decimal Total { get; init; }
        public string? Note { get; init; }
        public string? AdresseLivraison { get; init; }
        public int? TableNumero { get; init; }
        public string? UserId { get; init; }
        public string NomClient { get; init; } = string.Empty;
        public string Telephone { get; init; } = string.Empty;
        public DateTime DateCommande { get; init; }
        public DateTime DateMiseAJour { get; init; }
        public uint Version { get; init; }
    }

    internal sealed record LigneRow
    {
        public int? ArticleId { get; init; }
        public string NomFr { get; init; } = string.Empty;
        public string NomAr { get; init; } = string.Empty;
        public decimal PrixUnitaire { get; init; }
        public int Quantite { get; init; }
    }

    internal sealed record HistoriqueRow
    {
        public StatutCommande Statut { get; init; }
        public DateTime Date { get; init; }
        public string? ParUserId { get; init; }
        public string? ParNom { get; init; }
    }

    internal sealed record ActiveLigneRow
    {
        public string NomFr { get; init; } = string.Empty;
        public string NomAr { get; init; } = string.Empty;
        public int Quantite { get; init; }
    }

    internal sealed record ActiveRow
    {
        public int Id { get; init; }
        public string Numero { get; init; } = string.Empty;
        public StatutCommande Statut { get; init; }
        public TypeCommande TypeCommande { get; init; }
        public string NomClient { get; init; } = string.Empty;
        public int? TableNumero { get; init; }
        public string? Note { get; init; }
        public DateTime DateCommande { get; init; }
        public DateTime DateMiseAJour { get; init; }
        public uint Version { get; init; }
        public List<ActiveLigneRow> Lignes { get; init; } = [];
    }

    internal sealed record CounterRow
    {
        public StatutCommande Statut { get; init; }
        public int Nombre { get; init; }
    }

    internal static IQueryable<Commande> ApplyFilters(IQueryable<Commande> query, ListFilters f)
    {
        if (f.Statuts.Count > 0)
        {
            var statuts = f.Statuts;
            query = query.Where(c => statuts.Contains(c.Statut));
        }

        if (f.Type is { } type)
        {
            query = query.Where(c => c.TypeCommande == type);
        }

        if (f.EstPayee is { } paid)
        {
            query = query.Where(c => c.EstPayee == paid);
        }

        if (f.From is { } start)
        {
            var startUtc = start.Utc;
            query = query.Where(c => c.DateCommande >= startUtc);
        }

        if (f.To is { } end)
        {
            var endUtc = end.Utc;
            // Date seule (« 2024-06-30 ») : tout le jour inclus, donc borne exclusive au lendemain 00:00 UTC.
            query = end.IsDateOnly
                ? query.Where(c => c.DateCommande < endUtc.AddDays(1))
                : query.Where(c => c.DateCommande <= endUtc);
        }

        if (f.Term is { } term)
        {
            query = query.Where(c =>
                c.Numero.ToLower().Contains(term) ||
                c.NomClient.ToLower().Contains(term) ||
                c.Telephone.ToLower().Contains(term));
        }

        return query;
    }

    internal static IQueryable<SummaryRow> SummaryQuery(IQueryable<Commande> filtered, int page, int pageSize) =>
        filtered
            .OrderByDescending(c => c.DateCommande).ThenByDescending(c => c.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(c => new SummaryRow
            {
                Id = c.Id,
                Numero = c.Numero,
                Statut = c.Statut,
                TypeCommande = c.TypeCommande,
                NomClient = c.NomClient,
                Telephone = c.Telephone,
                TableNumero = c.Table != null ? (int?)c.Table.Numero : null,
                Total = c.Total,
                EstPayee = c.EstPayee,
                NombreArticles = c.Items.Sum(i => i.Quantite),
                DateCommande = c.DateCommande,
                DateMiseAJour = c.DateMiseAJour
            });

    internal static IQueryable<DetailRow> DetailQuery(AppDbContext db, int id) =>
        db.Commandes.AsNoTracking()
            .Where(x => x.Id == id)
            .Select(x => new DetailRow
            {
                Id = x.Id,
                Numero = x.Numero,
                Statut = x.Statut,
                TypeCommande = x.TypeCommande,
                ModePaiement = x.ModePaiement,
                EstPayee = x.EstPayee,
                SousTotal = x.SousTotal,
                FraisLivraison = x.FraisLivraison,
                Total = x.Total,
                Note = x.Note,
                AdresseLivraison = x.AdresseLivraison,
                TableNumero = x.Table != null ? (int?)x.Table.Numero : null,
                UserId = x.UserId,
                NomClient = x.NomClient,
                Telephone = x.Telephone,
                DateCommande = x.DateCommande,
                DateMiseAJour = x.DateMiseAJour,
                Version = x.Version
            });

    internal static IQueryable<LigneRow> LignesQuery(AppDbContext db, int id) =>
        db.CommandeItems.AsNoTracking()
            .Where(i => i.CommandeId == id)
            .OrderBy(i => i.Id)
            .Select(i => new LigneRow
            {
                ArticleId = i.ArticleId,
                NomFr = i.NomFr,
                NomAr = i.NomAr,
                PrixUnitaire = i.PrixUnitaire,
                Quantite = i.Quantite
            });

    // Projection ciblée : seuls l'identifiant et le nom d'affichage de l'auteur sortent de la base
    // (jamais l'entité utilisateur, donc ni hash de mot de passe ni security stamp).
    internal static IQueryable<HistoriqueRow> HistoriqueQuery(AppDbContext db, int id) =>
        db.HistoriqueStatuts.AsNoTracking()
            .Where(h => h.CommandeId == id)
            .OrderBy(h => h.Date).ThenBy(h => h.Id)
            .Select(h => new HistoriqueRow
            {
                Statut = h.Statut,
                Date = h.Date,
                ParUserId = h.ParUserId,
                ParNom = h.ParUser != null ? (h.ParUser.Nom ?? h.ParUser.UserName) : null
            });

    internal static IQueryable<ActiveRow> ActivesQuery(AppDbContext db) =>
        db.Commandes.AsNoTracking()
            .Where(c => ActiveStatuts.Contains(c.Statut))
            .OrderBy(c => c.DateCommande).ThenBy(c => c.Id)
            .Take(MaxActives)
            .Select(c => new ActiveRow
            {
                Id = c.Id,
                Numero = c.Numero,
                Statut = c.Statut,
                TypeCommande = c.TypeCommande,
                NomClient = c.NomClient,
                TableNumero = c.Table != null ? (int?)c.Table.Numero : null,
                Note = c.Note,
                DateCommande = c.DateCommande,
                DateMiseAJour = c.DateMiseAJour,
                Version = c.Version,
                Lignes = c.Items.OrderBy(i => i.Id)
                    .Select(i => new ActiveLigneRow { NomFr = i.NomFr, NomAr = i.NomAr, Quantite = i.Quantite })
                    .ToList()
            });

    internal static IQueryable<CounterRow> CountersQuery(AppDbContext db, DateTime startUtc, DateTime endUtc) =>
        db.Commandes.AsNoTracking()
            .Where(c => c.DateCommande >= startUtc && c.DateCommande < endUtc)
            .GroupBy(c => c.Statut)
            .Select(g => new CounterRow { Statut = g.Key, Nombre = g.Count() });

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
