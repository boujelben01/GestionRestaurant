using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes.Admin;
using Resto.Api.Features.Restaurant;

namespace Resto.Api.Features.Statistiques;

/// <summary>
/// Statistiques admin. Chaque route charge uniquement les colonnes nécessaires sur une période BORNÉE (366 jours
/// au plus), puis agrège en mémoire : le regroupement par jour ou par heure de Tunis n'est pas traduisible en SQL
/// de façon portable (conversion de fuseau). Les requêtes sont de simples sélections de colonnes filtrées.
/// </summary>
public class StatistiquesService(AppDbContext db, TimeProvider time)
{
    public const int MaxTopLimit = 20;
    public const int DefaultTopLimit = 10;
    private const string ClientRole = Roles.Client;

    private static readonly TimeZoneInfo Zone = OpeningHours.TunisZone;

    /// <summary>Résout la période demandée ; « aujourd'hui » est le jour civil de Tunis.</summary>
    public StatsPeriod Resolve(string? du, string? au) =>
        StatsPeriod.Resolve(du, au, TunisDay.Bounds(time.GetUtcNow(), Zone).Date);

    public async Task<ResumeResponse> ResumeAsync(string? du, string? au, CancellationToken ct)
    {
        var period = Resolve(du, au);
        var previous = period.Previous;
        // Une seule lecture couvre la période précédente ET la période courante (contiguës) ; on les sépare en mémoire.
        var data = await LoadAsync(previous.StartUtc(Zone), period.EndUtcExclusive(Zone), includeUsers: true, ct);

        var current = StatsMath.Values(period, data.Orders, data.Items, data.NewUsers, Zone);
        var before = StatsMath.Values(previous, data.Orders, data.Items, data.NewUsers, Zone);
        return new ResumeResponse(
            period.Du, period.Au, current, previous.Du, previous.Au, before, StatsMath.Variations(current, before));
    }

    public async Task<IReadOnlyList<VenteJourResponse>> VentesParJourAsync(string? du, string? au, CancellationToken ct)
    {
        var period = Resolve(du, au);
        var data = await LoadAsync(period.StartUtc(Zone), period.EndUtcExclusive(Zone), includeUsers: false, ct);
        return StatsMath.SalesByDay(period, data.Orders, data.Items, Zone);
    }

    public async Task<IReadOnlyList<TopArticleResponse>> TopArticlesAsync(
        string? du, string? au, int? limite, string? lang, CancellationToken ct)
    {
        var period = Resolve(du, au);
        var limit = Math.Clamp(limite ?? DefaultTopLimit, 1, MaxTopLimit);
        var items = await ItemsQuery(db, period.StartUtc(Zone), period.EndUtcExclusive(Zone)).ToListAsync(ct);
        return StatsMath.TopArticles(items.Select(ToItem), limit, Langue.Normalize(lang));
    }

    public async Task<IReadOnlyList<HeurePointeResponse>> HeuresDePointeAsync(string? du, string? au, CancellationToken ct)
    {
        var period = Resolve(du, au);
        var data = await LoadAsync(period.StartUtc(Zone), period.EndUtcExclusive(Zone), includeUsers: false, ct);
        return StatsMath.PeakHours(data.Orders, data.Items, Zone);
    }

    public async Task<RepartitionResponse> RepartitionAsync(string? du, string? au, string? lang, CancellationToken ct)
    {
        var period = Resolve(du, au);
        var data = await LoadAsync(period.StartUtc(Zone), period.EndUtcExclusive(Zone), includeUsers: false, ct);
        // Rattachement article → catégorie : deux petites lectures de colonnes (pas de jointure dans la requête des lignes).
        var articles = await ArticleCategoriesQuery(db).ToListAsync(ct);
        var categories = await CategoriesQuery(db).ToListAsync(ct);
        return StatsMath.Breakdown(
            data.Orders,
            data.Items,
            articles.ToDictionary(a => a.Id, a => a.CategorieId),
            categories.ToDictionary(c => c.Id, c => new StatCategory(c.Id, c.NomFr, c.NomAr)),
            Langue.Normalize(lang));
    }

    private sealed record Loaded(List<StatOrder> Orders, List<StatItem> Items, List<DateTime> NewUsers);

    private async Task<Loaded> LoadAsync(DateTime startUtc, DateTime endUtc, bool includeUsers, CancellationToken ct)
    {
        var orders = (await OrdersQuery(db, startUtc, endUtc).ToListAsync(ct))
            .Select(o => new StatOrder(o.DateCommande, o.Statut, o.TypeCommande, o.EstPayee, o.Total)).ToList();
        var items = (await ItemsQuery(db, startUtc, endUtc).ToListAsync(ct)).Select(ToItem).ToList();
        var users = includeUsers ? await NewClientsQuery(db, startUtc, endUtc).ToListAsync(ct) : [];
        return new Loaded(orders, items, users);
    }

    private static StatItem ToItem(ItemRow i) => new(
        i.CommandeId, i.DateCommande, i.Statut, i.TypeCommande, i.ArticleId, i.NomFr, i.NomAr, i.PrixUnitaire, i.Quantite);

    // ---------------------------------------------------------------------------------------------
    // Requêtes (internal static) : sélections de colonnes filtrées AVANT projection, sans agrégat ni GroupBy,
    // vérifiées par SqlTranslationTests avec le fournisseur Npgsql (EF InMemory ne détecte pas les erreurs).
    // ---------------------------------------------------------------------------------------------

    internal sealed record OrderRow
    {
        public DateTime DateCommande { get; init; }
        public StatutCommande Statut { get; init; }
        public TypeCommande TypeCommande { get; init; }
        public bool EstPayee { get; init; }
        public decimal Total { get; init; }
    }

    internal sealed record ItemRow
    {
        public int CommandeId { get; init; }
        public DateTime DateCommande { get; init; }
        public StatutCommande Statut { get; init; }
        public TypeCommande TypeCommande { get; init; }
        public int? ArticleId { get; init; }
        public string NomFr { get; init; } = string.Empty;
        public string NomAr { get; init; } = string.Empty;
        public decimal PrixUnitaire { get; init; }
        public int Quantite { get; init; }
    }

    internal sealed record ArticleCategoryRow
    {
        public int Id { get; init; }
        public int CategorieId { get; init; }
    }

    internal sealed record CategoryRow
    {
        public int Id { get; init; }
        public string NomFr { get; init; } = string.Empty;
        public string NomAr { get; init; } = string.Empty;
    }

    internal static IQueryable<OrderRow> OrdersQuery(AppDbContext db, DateTime startUtc, DateTime endUtc) =>
        db.Commandes.AsNoTracking()
            .Where(c => c.DateCommande >= startUtc && c.DateCommande < endUtc)
            .Select(c => new OrderRow
            {
                DateCommande = c.DateCommande,
                Statut = c.Statut,
                TypeCommande = c.TypeCommande,
                EstPayee = c.EstPayee,
                Total = c.Total
            });

    internal static IQueryable<ItemRow> ItemsQuery(AppDbContext db, DateTime startUtc, DateTime endUtc) =>
        db.CommandeItems.AsNoTracking()
            .Where(i => i.Commande.DateCommande >= startUtc && i.Commande.DateCommande < endUtc)
            .Select(i => new ItemRow
            {
                CommandeId = i.CommandeId,
                DateCommande = i.Commande.DateCommande,
                Statut = i.Commande.Statut,
                TypeCommande = i.Commande.TypeCommande,
                ArticleId = i.ArticleId,
                NomFr = i.NomFr,
                NomAr = i.NomAr,
                PrixUnitaire = i.PrixUnitaire,
                Quantite = i.Quantite
            });

    internal static IQueryable<ArticleCategoryRow> ArticleCategoriesQuery(AppDbContext db) =>
        db.Articles.AsNoTracking().Select(a => new ArticleCategoryRow { Id = a.Id, CategorieId = a.CategorieId });

    internal static IQueryable<CategoryRow> CategoriesQuery(AppDbContext db) =>
        db.Categories.AsNoTracking().Select(c => new CategoryRow { Id = c.Id, NomFr = c.NomFr, NomAr = c.NomAr });

    /// <summary>Dates de création des comptes Client de la période (rôle Client, jamais les administrateurs).</summary>
    internal static IQueryable<DateTime> NewClientsQuery(AppDbContext db, DateTime startUtc, DateTime endUtc) =>
        db.Users.AsNoTracking()
            .Where(u => u.DateCreation >= startUtc && u.DateCreation < endUtc
                        && db.UserRoles.Any(ur => ur.UserId == u.Id
                                                   && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == ClientRole)))
            .Select(u => u.DateCreation);
}
