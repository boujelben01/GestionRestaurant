using Resto.Api.Common;
using Resto.Api.Domain;
using Resto.Api.Features.Restaurant;
using Resto.Api.Features.Statistiques;

namespace Resto.Tests;

public class StatsPeriodTests
{
    private static readonly DateOnly Today = new(2024, 6, 15);

    [Fact]
    public void The_default_period_is_the_last_30_days_today_included()
    {
        var period = StatsPeriod.Resolve(null, null, Today);

        Assert.Equal(new DateOnly(2024, 5, 17), period.Du);
        Assert.Equal(Today, period.Au);
        Assert.Equal(30, period.Days);
    }

    [Fact]
    public void Only_a_start_date_runs_until_today_and_only_an_end_date_covers_the_30_days_before()
    {
        var fromOnly = StatsPeriod.Resolve("2024-06-01", null, Today);
        var toOnly = StatsPeriod.Resolve(null, "2024-03-31", Today);

        Assert.Equal((new DateOnly(2024, 6, 1), Today), (fromOnly.Du, fromOnly.Au));
        Assert.Equal((new DateOnly(2024, 3, 2), new DateOnly(2024, 3, 31)), (toOnly.Du, toOnly.Au));
        Assert.Equal(30, toOnly.Days);
    }

    [Fact]
    public void Bounds_are_inclusive_a_single_day_is_a_one_day_period()
    {
        var period = StatsPeriod.Resolve("2024-06-10", "2024-06-10", Today);

        Assert.Equal(1, period.Days);
        Assert.True(period.Contains(new DateOnly(2024, 6, 10)));
        Assert.False(period.Contains(new DateOnly(2024, 6, 9)));
        Assert.False(period.Contains(new DateOnly(2024, 6, 11)));
    }

    [Fact]
    public void The_previous_period_has_the_same_duration_and_ends_the_day_before()
    {
        var period = StatsPeriod.Resolve("2024-06-08", "2024-06-14", Today); // 7 jours

        var previous = period.Previous;

        Assert.Equal(7, previous.Days);
        Assert.Equal(new DateOnly(2024, 6, 1), previous.Du);
        Assert.Equal(new DateOnly(2024, 6, 7), previous.Au);
    }

    [Fact]
    public void The_utc_bounds_follow_tunis_midnight_and_the_end_is_exclusive()
    {
        var period = StatsPeriod.Resolve("2024-06-10", "2024-06-11", Today);

        // Tunis = UTC+1 : minuit local du 10 juin = 23:00 UTC le 9 ; fin exclue = minuit local du 12 juin.
        Assert.Equal(new DateTime(2024, 6, 9, 23, 0, 0, DateTimeKind.Utc), period.StartUtc());
        Assert.Equal(new DateTime(2024, 6, 11, 23, 0, 0, DateTimeKind.Utc), period.EndUtcExclusive());
    }

    [Fact]
    public void A_period_of_366_days_is_accepted_and_367_is_refused()
    {
        var ok = StatsPeriod.Resolve("2023-06-15", "2024-06-14", Today);
        Assert.Equal(366, ok.Days);

        var error = Assert.Throws<AppException>(() => StatsPeriod.Resolve("2023-06-14", "2024-06-14", Today));
        Assert.Equal(400, error.Status);
    }

    [Theory]
    [InlineData("pas-une-date", null)]
    [InlineData("2024-13-45", null)]
    [InlineData("2024-6-1", null)]
    [InlineData("01/06/2024", null)]
    [InlineData("2024-06-01T10:00:00Z", null)]
    [InlineData(null, "demain")]
    [InlineData("2024-06-10", "2024-06-01")]
    public void Invalid_or_inverted_dates_return_400(string? du, string? au)
    {
        var error = Assert.Throws<AppException>(() => StatsPeriod.Resolve(du, au, Today));

        Assert.Equal(400, error.Status);
    }

    [Fact]
    public void Blank_values_are_treated_as_absent()
    {
        var period = StatsPeriod.Resolve("  ", "", Today);

        Assert.Equal(30, period.Days);
        Assert.Equal(Today, period.Au);
    }
}

public class StatsMathTests
{
    private static readonly StatsPeriod June = new(new DateOnly(2024, 6, 1), new DateOnly(2024, 6, 3));

    private static DateTime Utc(int day, int hour, int minute = 0) => new(2024, 6, day, hour, minute, 0, DateTimeKind.Utc);

    private static StatOrder Order(DateTime date, StatutCommande statut = StatutCommande.Terminee, bool paid = true, decimal total = 10m,
        TypeCommande type = TypeCommande.ARemporter) => new(date, statut, type, paid, total);

    private static StatItem Item(DateTime date, decimal price, int qty, StatutCommande statut = StatutCommande.Terminee,
        int? articleId = 1, string nomFr = "Brik", string nomAr = "بريك", TypeCommande type = TypeCommande.ARemporter, int commande = 1) =>
        new(commande, date, statut, type, articleId, nomFr, nomAr, price, qty);

    // ---------- Fuseau ----------

    [Fact]
    public void An_order_at_23h30_utc_belongs_to_the_next_day_in_tunis()
    {
        Assert.Equal(new DateOnly(2024, 6, 2), StatsMath.LocalDay(Utc(1, 23, 30)));
        Assert.Equal(0, StatsMath.LocalHour(Utc(1, 23, 30)));
        Assert.Equal(new DateOnly(2024, 6, 1), StatsMath.LocalDay(Utc(1, 22, 59)));
        Assert.Equal(23, StatsMath.LocalHour(Utc(1, 22, 59)));
        Assert.Equal(new DateOnly(2024, 6, 1), StatsMath.LocalDay(Utc(1, 23, 0).AddMinutes(-1)));
        Assert.Equal(new DateOnly(2024, 6, 2), StatsMath.LocalDay(Utc(1, 23, 0)));
    }

    [Fact]
    public void Tunisia_has_no_daylight_saving_so_the_offset_is_constant_all_year()
    {
        foreach (var month in new[] { 1, 3, 7, 10 })
        {
            var utc = new DateTime(2024, month, 15, 12, 0, 0, DateTimeKind.Utc);
            Assert.Equal(13, StatsMath.LocalHour(utc));
        }

        Assert.Equal(TimeSpan.FromHours(1), OpeningHours.TunisZone.GetUtcOffset(new DateTime(2024, 7, 1, 12, 0, 0, DateTimeKind.Utc)));
    }

    // ---------- Ventes par jour ----------

    [Fact]
    public void Every_day_of_the_period_is_listed_and_days_without_sales_are_zero()
    {
        var orders = new[] { Order(Utc(1, 10)), Order(Utc(3, 10)) };
        var items = new[] { Item(Utc(1, 10), 5m, 2), Item(Utc(3, 10), 4m, 1) };

        var days = StatsMath.SalesByDay(June, orders, items);

        Assert.Equal(3, days.Count);
        Assert.Equal([new DateOnly(2024, 6, 1), new DateOnly(2024, 6, 2), new DateOnly(2024, 6, 3)], days.Select(d => d.Date).ToArray());
        Assert.Equal((10m, 1), (days[0].ChiffreAffaires, days[0].Commandes));
        Assert.Equal((0m, 0), (days[1].ChiffreAffaires, days[1].Commandes)); // jour sans vente
        Assert.Equal((4m, 1), (days[2].ChiffreAffaires, days[2].Commandes));
    }

    [Fact]
    public void Sales_are_filed_under_the_tunis_day_not_the_utc_day()
    {
        var orders = new[] { Order(Utc(1, 23, 30)) };
        var items = new[] { Item(Utc(1, 23, 30), 8m, 1) };

        var days = StatsMath.SalesByDay(June, orders, items);

        Assert.Equal(0m, days[0].ChiffreAffaires);   // 1er juin : rien
        Assert.Equal(8m, days[1].ChiffreAffaires);   // 2 juin à Tunis
        Assert.Equal(1, days[1].Commandes);
    }

    [Fact]
    public void Cancelled_orders_are_excluded_from_revenue_and_counts()
    {
        var orders = new[] { Order(Utc(1, 10)), Order(Utc(1, 11), StatutCommande.Annulee) };
        var items = new[] { Item(Utc(1, 10), 5m, 1), Item(Utc(1, 11), 100m, 1, StatutCommande.Annulee) };

        var day = StatsMath.SalesByDay(June, orders, items)[0];

        Assert.Equal(5m, day.ChiffreAffaires);
        Assert.Equal(1, day.Commandes);
    }

    // ---------- Résumé ----------

    [Fact]
    public void The_summary_computes_revenue_average_cancellations_and_amount_to_collect()
    {
        var orders = new[]
        {
            Order(Utc(1, 10), total: 13m, paid: true),
            Order(Utc(2, 10), StatutCommande.EnPreparation, paid: false, total: 23m),       // 20 + 3 de livraison
            Order(Utc(2, 12), StatutCommande.Annulee, paid: false, total: 50m),              // annulée : jamais à encaisser
            Order(Utc(9, 10), total: 999m, paid: false),                                      // hors période
        };
        var items = new[]
        {
            Item(Utc(1, 10), 6.5m, 2),                                                        // 13
            Item(Utc(2, 10), 10m, 2, StatutCommande.EnPreparation),                          // 20
            Item(Utc(2, 12), 50m, 1, StatutCommande.Annulee),
            Item(Utc(9, 10), 999m, 1),
        };

        var v = StatsMath.Values(June, orders, items, []);

        Assert.Equal(33m, v.ChiffreAffaires);
        Assert.Equal(2, v.NombreCommandes);
        Assert.Equal(16.5m, v.PanierMoyen);
        Assert.Equal(1, v.NombreAnnulees);
        Assert.Equal(23m, v.MontantAEncaisser); // Total (frais de livraison inclus) des non annulées non payées
    }

    [Fact]
    public void An_empty_period_yields_zeros_without_dividing_by_zero()
    {
        var v = StatsMath.Values(June, [], [], []);

        Assert.Equal(new ResumeValeurs(0m, 0, 0m, 0, 0m, 0), v);
    }

    [Fact]
    public void Line_amounts_are_rounded_to_two_decimals_like_at_order_time()
    {
        var items = new[] { Item(Utc(1, 10), 3.333m, 3) }; // 9,999 → 10,00

        Assert.Equal(10.00m, StatsMath.Values(June, [Order(Utc(1, 10))], items, []).ChiffreAffaires);
    }

    [Fact]
    public void New_clients_are_counted_by_tunis_day_within_the_period()
    {
        var created = new[] { Utc(1, 8), Utc(3, 22, 30), Utc(3, 23, 30), Utc(1, 0) };
        // 3 juin 23:30 UTC = 4 juin à Tunis (hors période) ; 1er juin 00:00 UTC = 1er juin 01:00 (dans la période).

        Assert.Equal(3, StatsMath.Values(June, [], [], created).NouveauxClients);
    }

    [Fact]
    public void The_summary_splits_two_contiguous_periods_from_one_load()
    {
        var previous = June.Previous; // 29-31 mai
        var orders = new[] { Order(new DateTime(2024, 5, 30, 10, 0, 0, DateTimeKind.Utc)), Order(Utc(1, 10)), Order(Utc(2, 10)) };
        var items = new[]
        {
            Item(new DateTime(2024, 5, 30, 10, 0, 0, DateTimeKind.Utc), 10m, 1),
            Item(Utc(1, 10), 10m, 1),
            Item(Utc(2, 10), 10m, 1),
        };

        var now = StatsMath.Values(June, orders, items, []);
        var before = StatsMath.Values(previous, orders, items, []);

        Assert.Equal(2, now.NombreCommandes);
        Assert.Equal(1, before.NombreCommandes);
        Assert.Equal(20m, now.ChiffreAffaires);
        Assert.Equal(10m, before.ChiffreAffaires);
    }

    // ---------- Variation ----------

    [Theory]
    [InlineData(150, 100, 50.0)]
    [InlineData(50, 100, -50.0)]
    [InlineData(100, 100, 0.0)]
    [InlineData(10, 3, 233.3)]
    [InlineData(0, 40, -100.0)]
    public void Variation_is_a_percentage_rounded_to_one_decimal(int current, int previous, double expected)
    {
        Assert.Equal((decimal)expected, StatsMath.Variation(current, previous));
    }

    [Fact]
    public void Variation_is_undefined_when_the_previous_value_is_zero()
    {
        Assert.Null(StatsMath.Variation(10m, 0m));
        Assert.Null(StatsMath.Variation(0m, 0m));
    }

    [Fact]
    public void Variations_cover_every_indicator()
    {
        var current = new ResumeValeurs(200m, 10, 20m, 2, 30m, 0);
        var previous = new ResumeValeurs(100m, 8, 12.5m, 0, 60m, 4);

        var v = StatsMath.Variations(current, previous);

        Assert.Equal(100.0m, v.ChiffreAffaires);
        Assert.Equal(25.0m, v.NombreCommandes);
        Assert.Equal(60.0m, v.PanierMoyen);
        Assert.Null(v.NombreAnnulees);          // précédente = 0
        Assert.Equal(-50.0m, v.MontantAEncaisser);
        Assert.Equal(-100.0m, v.NouveauxClients);
    }

    // ---------- Top articles ----------

    [Fact]
    public void Top_articles_are_sorted_by_quantity_then_revenue_and_limited()
    {
        var items = new[]
        {
            Item(Utc(1, 10), 4m, 5, articleId: 1, nomFr: "Brik"),
            Item(Utc(2, 10), 4m, 5, articleId: 1, nomFr: "Brik"),                 // Brik : 10 × 4 = 40
            Item(Utc(1, 11), 9m, 10, articleId: 2, nomFr: "Makloub"),             // Makloub : 10 × 9 = 90 (même quantité, plus de CA)
            Item(Utc(1, 12), 20m, 3, articleId: 3, nomFr: "Plat tounsi"),
            Item(Utc(1, 13), 2m, 1, articleId: 4, nomFr: "Thé"),
        };

        var top = StatsMath.TopArticles(items, 3, "fr");

        Assert.Equal(["Makloub", "Brik", "Plat tounsi"], top.Select(t => t.Nom).ToArray());
        Assert.Equal([10, 10, 3], top.Select(t => t.Quantite).ToArray());
        Assert.Equal(90m, top[0].ChiffreAffaires);
        Assert.Equal(40m, top[1].ChiffreAffaires);
    }

    [Fact]
    public void Top_articles_use_the_copied_name_in_the_requested_language_and_exclude_cancelled_orders()
    {
        var items = new[]
        {
            Item(Utc(1, 10), 4m, 2, articleId: 1, nomFr: "Brik", nomAr: "بريك"),
            Item(Utc(1, 11), 4m, 99, StatutCommande.Annulee, articleId: 2, nomFr: "Fantôme", nomAr: "شبح"),
        };

        Assert.Equal("بريك", Assert.Single(StatsMath.TopArticles(items, 10, "ar")).Nom);
        Assert.Equal("Brik", Assert.Single(StatsMath.TopArticles(items, 10, "fr")).Nom);
        Assert.Equal("Brik", Assert.Single(StatsMath.TopArticles(items, 10, "de")).Nom); // langue inconnue : français
    }

    [Fact]
    public void Lines_of_a_deleted_article_are_grouped_by_their_copied_name()
    {
        var items = new[]
        {
            Item(Utc(1, 10), 3m, 2, articleId: null, nomFr: "Ancien plat"),
            Item(Utc(2, 10), 3m, 1, articleId: null, nomFr: "Ancien plat"),
            Item(Utc(2, 11), 3m, 1, articleId: null, nomFr: "Autre ancien"),
        };

        var top = StatsMath.TopArticles(items, 10, "fr");

        Assert.Equal(2, top.Count);
        Assert.Equal(("Ancien plat", 3, null), (top[0].Nom, top[0].Quantite, top[0].ArticleId));
    }

    // ---------- Heures de pointe ----------

    [Fact]
    public void Peak_hours_always_has_24_entries_in_tunis_time()
    {
        var orders = new[] { Order(Utc(1, 11)), Order(Utc(1, 11, 30)), Order(Utc(1, 22, 30)) };
        var items = new[] { Item(Utc(1, 11), 5m, 1), Item(Utc(1, 11, 30), 5m, 2), Item(Utc(1, 22, 30), 7m, 1) };

        var hours = StatsMath.PeakHours(orders, items);

        Assert.Equal(24, hours.Count);
        Assert.Equal(Enumerable.Range(0, 24), hours.Select(h => h.Heure));
        Assert.Equal((2, 15m), (hours[12].Commandes, hours[12].ChiffreAffaires)); // 11:xx UTC = 12:xx Tunis
        Assert.Equal((1, 7m), (hours[23].Commandes, hours[23].ChiffreAffaires));  // 22:30 UTC = 23:30 Tunis
        Assert.Equal((0, 0m), (hours[3].Commandes, hours[3].ChiffreAffaires));
    }

    [Fact]
    public void Peak_hours_ignore_cancelled_orders()
    {
        var hours = StatsMath.PeakHours([Order(Utc(1, 11), StatutCommande.Annulee)], [Item(Utc(1, 11), 5m, 1, StatutCommande.Annulee)]);

        Assert.All(hours, h => Assert.Equal((0, 0m), (h.Commandes, h.ChiffreAffaires)));
    }

    // ---------- Répartition ----------

    [Fact]
    public void The_breakdown_lists_every_type_and_status_and_counts_categories_with_others_last()
    {
        var orders = new[]
        {
            Order(Utc(1, 10), type: TypeCommande.SurPlace),
            Order(Utc(1, 11), type: TypeCommande.Livraison),
            Order(Utc(1, 12), StatutCommande.Annulee, type: TypeCommande.Livraison),
        };
        var items = new[]
        {
            Item(Utc(1, 10), 5m, 2, articleId: 1, type: TypeCommande.SurPlace),                 // catégorie 10
            Item(Utc(1, 11), 8m, 1, articleId: 2, type: TypeCommande.Livraison),                // catégorie 20
            Item(Utc(1, 11), 3m, 4, articleId: null, type: TypeCommande.Livraison),             // article supprimé → Autres
            Item(Utc(1, 12), 100m, 1, StatutCommande.Annulee, articleId: 1, type: TypeCommande.Livraison),
        };
        var articleCategory = new Dictionary<int, int> { [1] = 10, [2] = 20 };
        var categories = new Dictionary<int, StatCategory>
        {
            [10] = new(10, "Entrées", "المقبلات"),
            [20] = new(20, "Plats", "الأطباق"),
        };

        var result = StatsMath.Breakdown(orders, items, articleCategory, categories, "fr");

        Assert.Equal(3, result.ParType.Count);
        Assert.Equal((1, 10m), (result.ParType.Single(t => t.Type == TypeCommande.SurPlace).Commandes, result.ParType.Single(t => t.Type == TypeCommande.SurPlace).ChiffreAffaires));
        Assert.Equal((1, 20m), (result.ParType.Single(t => t.Type == TypeCommande.Livraison).Commandes, result.ParType.Single(t => t.Type == TypeCommande.Livraison).ChiffreAffaires)); // l'annulée est exclue
        Assert.Equal((0, 0m), (result.ParType.Single(t => t.Type == TypeCommande.ARemporter).Commandes, 0m));

        Assert.Equal(5, result.ParStatut.Count);
        Assert.Equal(1, result.ParStatut.Single(s => s.Statut == StatutCommande.Annulee).Commandes);
        Assert.Equal(0m, result.ParStatut.Single(s => s.Statut == StatutCommande.Annulee).ChiffreAffaires);
        Assert.Equal(2, result.ParStatut.Single(s => s.Statut == StatutCommande.Terminee).Commandes);

        Assert.Equal(["Entrées", "Plats", "Autres"], result.ParCategorie.Select(c => c.Nom).ToArray());
        Assert.Equal(10m, result.ParCategorie[0].ChiffreAffaires);
        Assert.Null(result.ParCategorie[^1].CategorieId);
        Assert.Equal((4, 12m), (result.ParCategorie[^1].Quantite, result.ParCategorie[^1].ChiffreAffaires));
    }

    [Fact]
    public void Category_names_follow_the_requested_language_and_others_is_translated()
    {
        var items = new[] { Item(Utc(1, 10), 5m, 1, articleId: 1), Item(Utc(1, 10), 5m, 1, articleId: null) };

        var result = StatsMath.Breakdown(
            [Order(Utc(1, 10))], items, new Dictionary<int, int> { [1] = 10 },
            new Dictionary<int, StatCategory> { [10] = new(10, "Entrées", "المقبلات") }, "ar");

        Assert.Equal(["المقبلات", "أخرى"], result.ParCategorie.Select(c => c.Nom).ToArray());
    }

    [Fact]
    public void An_article_whose_category_is_unknown_falls_into_others()
    {
        var items = new[] { Item(Utc(1, 10), 5m, 1, articleId: 7) };

        var result = StatsMath.Breakdown([Order(Utc(1, 10))], items, new Dictionary<int, int> { [7] = 99 },
            new Dictionary<int, StatCategory>(), "fr");

        Assert.Equal("Autres", Assert.Single(result.ParCategorie).Nom);
    }
}
