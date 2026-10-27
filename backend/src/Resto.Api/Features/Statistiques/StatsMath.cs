using Resto.Api.Common;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Restaurant;

namespace Resto.Api.Features.Statistiques;

/// <summary>Une commande, colonnes nécessaires aux statistiques seulement.</summary>
internal sealed record StatOrder(DateTime DateCommande, StatutCommande Statut, TypeCommande Type, bool EstPayee, decimal Total);

/// <summary>Une ligne de commande avec les colonnes de sa commande (nom et prix copiés à la commande).</summary>
internal sealed record StatItem(
    int CommandeId,
    DateTime DateCommande,
    StatutCommande Statut,
    TypeCommande Type,
    int? ArticleId,
    string NomFr,
    decimal PrixUnitaire,
    int Quantite)
{
    /// <summary>Montant de la ligne, arrondi à 2 décimales comme à la création de la commande.</summary>
    public decimal Montant => CommandeRules.Round(PrixUnitaire * Quantite);
}

internal sealed record StatCategory(int Id, string NomFr);

/// <summary>
/// Agrégation des statistiques EN MÉMOIRE sur une période bornée. Les jours et heures sont ceux de Tunis (UTC+1,
/// sans heure d'été) : un instant UTC est converti avant d'être rangé dans un jour ou une heure. Fonctions pures,
/// testées sans base.
/// </summary>
internal static class StatsMath
{
    public static DateOnly LocalDay(DateTime utc, TimeZoneInfo? zone = null) =>
        DateOnly.FromDateTime(ToLocal(utc, zone));

    public static int LocalHour(DateTime utc, TimeZoneInfo? zone = null) => ToLocal(utc, zone).Hour;

    private static DateTime ToLocal(DateTime utc, TimeZoneInfo? zone) =>
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), zone ?? OpeningHours.TunisZone);

    private static bool IsSale(StatutCommande statut) => statut != StatutCommande.Annulee;

    private static decimal Sum(IEnumerable<decimal> values) => values.Aggregate(0m, (a, b) => a + b);

    // --- Résumé ---

    public static ResumeValeurs Values(
        StatsPeriod period,
        IEnumerable<StatOrder> orders,
        IEnumerable<StatItem> items,
        IEnumerable<DateTime> newClients,
        TimeZoneInfo? zone = null)
    {
        var inPeriod = orders.Where(o => period.Contains(LocalDay(o.DateCommande, zone))).ToList();
        var sales = inPeriod.Where(o => IsSale(o.Statut)).ToList();
        var revenue = Sum(items
            .Where(i => IsSale(i.Statut) && period.Contains(LocalDay(i.DateCommande, zone)))
            .Select(i => i.Montant));

        return new ResumeValeurs(
            revenue,
            sales.Count,
            sales.Count == 0 ? 0m : Math.Round(revenue / sales.Count, 2, MidpointRounding.AwayFromZero),
            inPeriod.Count(o => o.Statut == StatutCommande.Annulee),
            Sum(sales.Where(o => !o.EstPayee).Select(o => o.Total)),
            newClients.Count(d => period.Contains(LocalDay(d, zone))));
    }

    /// <summary>Variation en % (1 décimale) ; null quand la valeur précédente est 0 (variation indéfinie).</summary>
    public static decimal? Variation(decimal current, decimal previous) =>
        previous == 0m ? null : Math.Round((current - previous) / previous * 100m, 1, MidpointRounding.AwayFromZero);

    public static ResumeVariations Variations(ResumeValeurs current, ResumeValeurs previous) => new(
        Variation(current.ChiffreAffaires, previous.ChiffreAffaires),
        Variation(current.NombreCommandes, previous.NombreCommandes),
        Variation(current.PanierMoyen, previous.PanierMoyen),
        Variation(current.NombreAnnulees, previous.NombreAnnulees),
        Variation(current.MontantAEncaisser, previous.MontantAEncaisser),
        Variation(current.NouveauxClients, previous.NouveauxClients));

    // --- Ventes par jour ---

    /// <summary>Une entrée par jour de la période, y compris les jours sans vente (à 0).</summary>
    public static IReadOnlyList<VenteJourResponse> SalesByDay(
        StatsPeriod period, IEnumerable<StatOrder> orders, IEnumerable<StatItem> items, TimeZoneInfo? zone = null)
    {
        var revenue = items.Where(i => IsSale(i.Statut))
            .GroupBy(i => LocalDay(i.DateCommande, zone))
            .ToDictionary(g => g.Key, g => Sum(g.Select(i => i.Montant)));
        var count = orders.Where(o => IsSale(o.Statut))
            .GroupBy(o => LocalDay(o.DateCommande, zone))
            .ToDictionary(g => g.Key, g => g.Count());

        return Enumerable.Range(0, period.Days)
            .Select(offset => period.Du.AddDays(offset))
            .Select(day => new VenteJourResponse(day, revenue.GetValueOrDefault(day), count.GetValueOrDefault(day)))
            .ToList();
    }

    // --- Top articles ---

    public static IReadOnlyList<TopArticleResponse> TopArticles(IEnumerable<StatItem> items, int limit)
    {
        return items.Where(i => IsSale(i.Statut))
            // Une ligne dont l'article a été supprimé n'a plus d'identifiant : on regroupe alors sur le nom copié.
            .GroupBy(i => i.ArticleId is { } id ? $"a:{id}" : $"n:{i.NomFr}")
            .Select(g =>
            {
                var latest = g.OrderByDescending(i => i.DateCommande).First();
                return new TopArticleResponse(
                    latest.ArticleId,
                    latest.NomFr,
                    g.Sum(i => i.Quantite),
                    Sum(g.Select(i => i.Montant)));
            })
            .OrderByDescending(t => t.Quantite).ThenByDescending(t => t.ChiffreAffaires).ThenBy(t => t.Nom, StringComparer.Ordinal)
            .Take(limit)
            .ToList();
    }

    // --- Heures de pointe ---

    /// <summary>24 entrées (heure locale 0 à 23), les heures sans commande à 0.</summary>
    public static IReadOnlyList<HeurePointeResponse> PeakHours(
        IEnumerable<StatOrder> orders, IEnumerable<StatItem> items, TimeZoneInfo? zone = null)
    {
        var count = orders.Where(o => IsSale(o.Statut)).GroupBy(o => LocalHour(o.DateCommande, zone))
            .ToDictionary(g => g.Key, g => g.Count());
        var revenue = items.Where(i => IsSale(i.Statut)).GroupBy(i => LocalHour(i.DateCommande, zone))
            .ToDictionary(g => g.Key, g => Sum(g.Select(i => i.Montant)));

        return Enumerable.Range(0, 24)
            .Select(h => new HeurePointeResponse(h, count.GetValueOrDefault(h), revenue.GetValueOrDefault(h)))
            .ToList();
    }

    // --- Répartition ---

    public static RepartitionResponse Breakdown(
        IEnumerable<StatOrder> orders,
        IEnumerable<StatItem> items,
        IReadOnlyDictionary<int, int> categoryOfArticle,
        IReadOnlyDictionary<int, StatCategory> categories)
    {
        var orderList = orders.ToList();
        var allItems = items.ToList();
        var itemList = allItems.Where(i => IsSale(i.Statut)).ToList();

        var parType = Enum.GetValues<TypeCommande>().Select(t => new RepartitionTypeResponse(
            t,
            orderList.Count(o => IsSale(o.Statut) && o.Type == t),
            Sum(itemList.Where(i => i.Type == t).Select(i => i.Montant)))).ToList();

        // Le chiffre d'affaires d'une commande annulée est 0 : elle n'apparaît qu'en nombre.
        var parStatut = Enum.GetValues<StatutCommande>().Select(s => new RepartitionStatutResponse(
            s,
            orderList.Count(o => o.Statut == s),
            s == StatutCommande.Annulee ? 0m : Sum(allItems.Where(i => i.Statut == s).Select(i => i.Montant)))).ToList();

        var parCategorie = itemList
            .GroupBy(i => i.ArticleId is { } a && categoryOfArticle.TryGetValue(a, out var c) && categories.ContainsKey(c)
                ? (int?)c
                : null)
            .Select(g => new RepartitionCategorieResponse(
                g.Key,
                g.Key is { } id ? categories[id].NomFr : Other,
                g.Sum(i => i.Quantite),
                Sum(g.Select(i => i.Montant))))
            .OrderBy(c => c.CategorieId is null) // « Autres » en dernier
            .ThenByDescending(c => c.ChiffreAffaires).ThenBy(c => c.Nom, StringComparer.Ordinal)
            .ToList();

        return new RepartitionResponse(parType, parStatut, parCategorie);
    }

    public const string Other = "Autres";
}
