using System.Net;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes.Admin;

namespace Resto.Tests;

// EF InMemory : évalue les requêtes en mémoire et n'a pas de vrai fuseau SQL ; la traduction SQL des requêtes est
// vérifiée à part (SqlTranslationTests). Chaque test utilise sa propre année (2001, 2002…) pour que les données
// d'un test n'apparaissent jamais dans la période d'un autre (la base est partagée par la classe).
public class AdminStatistiquesApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static string Period(int year) => $"du={year}-06-01&au={year}-06-10";

    private sealed record Line(int? ArticleId, string NomFr, decimal Prix, int Quantite);

    private async Task SeedAsync(
        DateTime utc,
        Line[] lines,
        StatutCommande statut = StatutCommande.Terminee,
        TypeCommande type = TypeCommande.ARemporter,
        bool paid = true,
        decimal? total = null)
    {
        await factory.CreateClientAsync(); // garantit le seed du catalogue
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var sub = lines.Sum(l => Math.Round(l.Prix * l.Quantite, 2));
        db.Commandes.Add(new Commande
        {
            Numero = "ST-" + Guid.NewGuid().ToString("N")[..12],
            NomClient = "stat",
            Telephone = "+21620000000",
            Statut = statut,
            TypeCommande = type,
            EstPayee = paid,
            SousTotal = sub,
            Total = total ?? sub,
            DateCommande = DateTime.SpecifyKind(utc, DateTimeKind.Utc),
            DateMiseAJour = DateTime.SpecifyKind(utc, DateTimeKind.Utc),
            Items = lines.Select(l => new CommandeItem
            {
                ArticleId = l.ArticleId,
                NomFr = l.NomFr,
                PrixUnitaire = l.Prix,
                Quantite = l.Quantite
            }).ToList()
        });
        await db.SaveChangesAsync();
    }

    private static DateTime At(int year, int month, int day, int hour = 10, int minute = 0) =>
        new(year, month, day, hour, minute, 0, DateTimeKind.Utc);

    // ---------- Accès ----------

    public static TheoryData<string> Routes => new()
    {
        "resume", "ventes-par-jour", "top-articles", "heures-de-pointe", "repartition"
    };

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Statistics_routes_return_401_without_token(string route)
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync($"api/admin/statistiques/{route}")).StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Statistics_routes_return_403_for_a_client(string route)
    {
        var client = await factory.CreateClientAsync("client");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"api/admin/statistiques/{route}")).StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Statistics_routes_return_200_for_an_admin_even_on_an_empty_period(string route)
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"api/admin/statistiques/{route}?du=1990-01-01&au=1990-01-31")).StatusCode);
    }

    // ---------- Période ----------

    [Fact]
    public async Task Without_parameters_the_period_is_the_last_30_days_ending_today_in_tunis()
    {
        var admin = await factory.CreateClientAsync("admin");
        var before = TunisDay.Bounds(DateTimeOffset.UtcNow).Date;

        var days = (await Json(await admin.GetAsync("api/admin/statistiques/ventes-par-jour"))).EnumerateArray().ToList();

        var after = TunisDay.Bounds(DateTimeOffset.UtcNow).Date;
        Assert.Equal(30, days.Count);
        var last = DateOnly.Parse(days[^1].GetProperty("date").GetString()!);
        Assert.True(last == before || last == after); // tolérance si minuit de Tunis passe pendant le test
        Assert.Equal(last.AddDays(-29), DateOnly.Parse(days[0].GetProperty("date").GetString()!));
    }

    [Theory]
    [InlineData("du=pas-une-date")]
    [InlineData("au=2024-13-45")]
    [InlineData("du=2024-06-10&au=2024-06-01")]
    [InlineData("du=2020-01-01&au=2021-12-31")]   // plus de 366 jours
    [InlineData("du=2023-06-14&au=2024-06-14")]   // 367 jours
    [InlineData("du=2024-06-01T10:00:00Z")]
    public async Task An_invalid_or_too_long_period_returns_400_on_every_route(string query)
    {
        var admin = await factory.CreateClientAsync("admin");

        foreach (var route in new[] { "resume", "ventes-par-jour", "top-articles", "heures-de-pointe", "repartition" })
        {
            var response = await admin.GetAsync($"api/admin/statistiques/{route}?{query}");
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        }
    }

    [Fact]
    public async Task A_period_of_exactly_366_days_is_accepted()
    {
        var admin = await factory.CreateClientAsync("admin");

        var response = await admin.GetAsync("api/admin/statistiques/ventes-par-jour?du=2023-06-15&au=2024-06-14");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(366, (await Json(response)).GetArrayLength());
    }

    // ---------- Ventes par jour : bornes, fuseau, annulées ----------

    [Fact]
    public async Task Period_bounds_are_inclusive_and_follow_tunis_midnight()
    {
        const int year = 2001;
        var admin = await factory.CreateClientAsync("admin");
        var line = new Line(null, "Plat", 10m, 1);
        await SeedAsync(At(year, 5, 31, 22, 59), [line]);   // 23:59 le 31 mai à Tunis : avant la période
        await SeedAsync(At(year, 5, 31, 23, 0), [line]);    // 00:00 le 1er juin à Tunis : PREMIÈRE minute incluse
        await SeedAsync(At(year, 6, 10, 22, 59), [line]);   // 23:59 le 10 juin à Tunis : DERNIÈRE minute incluse
        await SeedAsync(At(year, 6, 10, 23, 0), [line]);    // 00:00 le 11 juin à Tunis : hors période

        var days = (await Json(await admin.GetAsync($"api/admin/statistiques/ventes-par-jour?{Period(year)}"))).EnumerateArray().ToList();

        Assert.Equal(10, days.Count);
        Assert.Equal($"{year}-06-01", days[0].GetProperty("date").GetString());
        Assert.Equal($"{year}-06-10", days[^1].GetProperty("date").GetString());
        Assert.Equal(1, days[0].GetProperty("commandes").GetInt32());
        Assert.Equal(1, days[^1].GetProperty("commandes").GetInt32());
        Assert.Equal(2, days.Sum(d => d.GetProperty("commandes").GetInt32()));
        Assert.Equal(20m, days.Sum(d => d.GetProperty("chiffreAffaires").GetDecimal()));
    }

    [Fact]
    public async Task An_order_at_23h30_utc_is_counted_on_the_next_day_in_tunis()
    {
        const int year = 2002;
        var admin = await factory.CreateClientAsync("admin");
        await SeedAsync(At(year, 6, 3, 23, 30), [new Line(null, "Plat", 12m, 1)]);

        var days = (await Json(await admin.GetAsync($"api/admin/statistiques/ventes-par-jour?{Period(year)}"))).EnumerateArray().ToList();

        Assert.Equal(0m, days.Single(d => d.GetProperty("date").GetString() == $"{year}-06-03").GetProperty("chiffreAffaires").GetDecimal());
        var next = days.Single(d => d.GetProperty("date").GetString() == $"{year}-06-04");
        Assert.Equal(12m, next.GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(1, next.GetProperty("commandes").GetInt32());
    }

    [Fact]
    public async Task Days_without_sales_are_listed_at_zero()
    {
        const int year = 2003;
        var admin = await factory.CreateClientAsync("admin");
        await SeedAsync(At(year, 6, 5), [new Line(null, "Plat", 9m, 2)]);

        var days = (await Json(await admin.GetAsync($"api/admin/statistiques/ventes-par-jour?{Period(year)}"))).EnumerateArray().ToList();

        Assert.Equal(10, days.Count);
        Assert.Equal(18m, days[4].GetProperty("chiffreAffaires").GetDecimal());
        Assert.All(days.Where((_, i) => i != 4), d =>
        {
            Assert.Equal(0m, d.GetProperty("chiffreAffaires").GetDecimal());
            Assert.Equal(0, d.GetProperty("commandes").GetInt32());
        });
    }

    [Fact]
    public async Task Cancelled_orders_are_excluded_from_revenue_everywhere()
    {
        const int year = 2004;
        var admin = await factory.CreateClientAsync("admin");
        var line = new Line(null, "Plat", 10m, 1);
        await SeedAsync(At(year, 6, 2), [line]);
        await SeedAsync(At(year, 6, 2), [new Line(null, "Annulé", 500m, 3)], statut: StatutCommande.Annulee);

        var resume = await Json(await admin.GetAsync($"api/admin/statistiques/resume?{Period(year)}"));
        var periode = resume.GetProperty("periode");

        Assert.Equal(10m, periode.GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(1, periode.GetProperty("nombreCommandes").GetInt32());
        Assert.Equal(1, periode.GetProperty("nombreAnnulees").GetInt32());
        var days = await Json(await admin.GetAsync($"api/admin/statistiques/ventes-par-jour?{Period(year)}"));
        Assert.Equal(10m, days.EnumerateArray().Sum(d => d.GetProperty("chiffreAffaires").GetDecimal()));
        var top = await Json(await admin.GetAsync($"api/admin/statistiques/top-articles?{Period(year)}"));
        Assert.DoesNotContain(top.EnumerateArray(), t => t.GetProperty("nom").GetString() == "Annulé");
    }

    // ---------- Résumé ----------

    [Fact]
    public async Task The_summary_reports_revenue_average_amount_to_collect_and_compares_with_the_previous_period()
    {
        const int year = 2005;
        var admin = await factory.CreateClientAsync("admin");
        // Période courante (1-10 juin) : 2 commandes, CA 30, une non payée de 23 (20 + 3 de livraison).
        await SeedAsync(At(year, 6, 2), [new Line(null, "A", 10m, 1)]);
        await SeedAsync(At(year, 6, 5), [new Line(null, "B", 10m, 2)], statut: StatutCommande.EnPreparation, type: TypeCommande.Livraison, paid: false, total: 23m);
        // Période précédente (22-31 mai) : 1 commande de 15.
        await SeedAsync(At(year, 5, 25), [new Line(null, "A", 15m, 1)]);

        var resume = await Json(await admin.GetAsync($"api/admin/statistiques/resume?{Period(year)}"));

        var now = resume.GetProperty("periode");
        Assert.Equal(30m, now.GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(2, now.GetProperty("nombreCommandes").GetInt32());
        Assert.Equal(15m, now.GetProperty("panierMoyen").GetDecimal());
        Assert.Equal(23m, now.GetProperty("montantAEncaisser").GetDecimal());
        Assert.Equal($"{year}-05-22", resume.GetProperty("precedenteDu").GetString());
        Assert.Equal($"{year}-05-31", resume.GetProperty("precedenteAu").GetString());
        var before = resume.GetProperty("precedente");
        Assert.Equal(15m, before.GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(1, before.GetProperty("nombreCommandes").GetInt32());
        var variation = resume.GetProperty("variation");
        Assert.Equal(100.0m, variation.GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(100.0m, variation.GetProperty("nombreCommandes").GetDecimal());
        Assert.Equal(0.0m, variation.GetProperty("panierMoyen").GetDecimal());
        Assert.Equal(JsonValueKind.Null, variation.GetProperty("nombreAnnulees").ValueKind);   // précédente = 0
        Assert.Equal(JsonValueKind.Null, variation.GetProperty("montantAEncaisser").ValueKind);
    }

    [Fact]
    public async Task The_variation_is_null_when_the_previous_period_is_empty()
    {
        const int year = 2006;
        var admin = await factory.CreateClientAsync("admin");
        await SeedAsync(At(year, 6, 2), [new Line(null, "A", 10m, 1)]);

        var resume = await Json(await admin.GetAsync($"api/admin/statistiques/resume?{Period(year)}"));

        Assert.Equal(JsonValueKind.Null, resume.GetProperty("variation").GetProperty("chiffreAffaires").ValueKind);
        Assert.Equal(0m, resume.GetProperty("precedente").GetProperty("chiffreAffaires").GetDecimal());
    }

    [Fact]
    public async Task An_empty_period_gives_zero_everywhere_without_error()
    {
        var admin = await factory.CreateClientAsync("admin");

        var resume = await Json(await admin.GetAsync("api/admin/statistiques/resume?du=1991-06-01&au=1991-06-10"));

        var now = resume.GetProperty("periode");
        Assert.Equal(0m, now.GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(0m, now.GetProperty("panierMoyen").GetDecimal());
        Assert.Equal(0, now.GetProperty("nombreCommandes").GetInt32());
    }

    [Fact]
    public async Task New_clients_are_the_client_accounts_created_in_the_period_and_never_admins()
    {
        const int year = 2007;
        var admin = await factory.CreateClientAsync("admin");
        using (var scope = factory.Services.CreateScope())
        {
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            async Task Create(string name, string role, DateTime created)
            {
                var user = new ApplicationUser { UserName = name, Email = $"{name}@resto.local", Nom = name, DateCreation = created };
                Assert.True((await users.CreateAsync(user, ApiFactory.Password)).Succeeded);
                await users.AddToRoleAsync(user, role);
            }

            await Create("nc-inperiod-1", Roles.Client, At(year, 6, 2));
            await Create("nc-inperiod-2", Roles.Client, At(year, 6, 9));
            await Create("nc-before", Roles.Client, At(year, 5, 25));          // période précédente (22-31 mai)
            await Create("nc-admin", Roles.Admin, At(year, 6, 3));              // un admin n'est pas un client
        }

        var resume = await Json(await admin.GetAsync($"api/admin/statistiques/resume?{Period(year)}"));

        Assert.Equal(2, resume.GetProperty("periode").GetProperty("nouveauxClients").GetInt32());
        Assert.Equal(1, resume.GetProperty("precedente").GetProperty("nouveauxClients").GetInt32());
        Assert.Equal(100.0m, resume.GetProperty("variation").GetProperty("nouveauxClients").GetDecimal());
    }

    // ---------- Top articles ----------

    [Fact]
    public async Task Top_articles_are_sorted_by_quantity_and_limited()
    {
        const int year = 2008;
        var admin = await factory.CreateClientAsync("admin");
        var brik = await factory.ArticleIdAsync("Brik");
        await SeedAsync(At(year, 6, 2), [new Line(brik, "Brik", 3.5m, 5), new Line(null, "Ancien plat", 6m, 2)]);
        await SeedAsync(At(year, 6, 3), [new Line(brik, "Brik", 3.5m, 4), new Line(null, "Ancien plat", 6m, 1)]);
        await SeedAsync(At(year, 6, 4), [new Line(null, "Thé", 1.5m, 1)]);

        var fr = (await Json(await admin.GetAsync($"api/admin/statistiques/top-articles?{Period(year)}"))).EnumerateArray().ToList();
        var one = await Json(await admin.GetAsync($"api/admin/statistiques/top-articles?{Period(year)}&limite=1"));

        Assert.Equal(["Brik", "Ancien plat", "Thé"], fr.Select(t => t.GetProperty("nom").GetString()!).ToArray());
        Assert.Equal([9, 3, 1], fr.Select(t => t.GetProperty("quantite").GetInt32()).ToArray());
        Assert.Equal(31.5m, fr[0].GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(brik, fr[0].GetProperty("articleId").GetInt32());
        Assert.Equal(JsonValueKind.Null, fr[1].GetProperty("articleId").ValueKind); // article supprimé : regroupé par nom copié
        Assert.Equal(1, one.GetArrayLength());
    }

    [Theory]
    [InlineData(0, 1)]
    [InlineData(-5, 1)]
    [InlineData(999, 20)]
    public async Task The_top_limit_is_clamped_between_1_and_20(int requested, int maxExpected)
    {
        var admin = await factory.CreateClientAsync("admin");

        var response = await admin.GetAsync($"api/admin/statistiques/top-articles?du=1992-01-01&au=1992-01-31&limite={requested}");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.True((await Json(response)).GetArrayLength() <= maxExpected);
    }

    [Fact]
    public async Task The_top_never_returns_more_than_20_articles()
    {
        const int year = 2009;
        var admin = await factory.CreateClientAsync("admin");
        await SeedAsync(At(year, 6, 2), Enumerable.Range(1, 25).Select(i => new Line(null, $"Plat {i:D2}", 2m, 1)).ToArray());

        var all = await Json(await admin.GetAsync($"api/admin/statistiques/top-articles?{Period(year)}&limite=999"));

        Assert.Equal(20, all.GetArrayLength());
    }

    // ---------- Heures de pointe ----------

    [Fact]
    public async Task Peak_hours_has_24_entries_in_tunis_time_and_excludes_cancelled_orders()
    {
        const int year = 2010;
        var admin = await factory.CreateClientAsync("admin");
        await SeedAsync(At(year, 6, 2, 11, 10), [new Line(null, "A", 5m, 1)]);          // 12h à Tunis
        await SeedAsync(At(year, 6, 3, 11, 50), [new Line(null, "A", 5m, 2)]);          // 12h
        await SeedAsync(At(year, 6, 4, 23, 30), [new Line(null, "A", 4m, 1)]);          // 00h (jour suivant)
        await SeedAsync(At(year, 6, 4, 11, 0), [new Line(null, "A", 99m, 1)], statut: StatutCommande.Annulee);

        var hours = (await Json(await admin.GetAsync($"api/admin/statistiques/heures-de-pointe?{Period(year)}"))).EnumerateArray().ToList();

        Assert.Equal(24, hours.Count);
        Assert.Equal(Enumerable.Range(0, 24), hours.Select(h => h.GetProperty("heure").GetInt32()));
        Assert.Equal(2, hours[12].GetProperty("commandes").GetInt32());
        Assert.Equal(15m, hours[12].GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(1, hours[0].GetProperty("commandes").GetInt32());
        Assert.Equal(0, hours[1].GetProperty("commandes").GetInt32());
    }

    // ---------- Répartition ----------

    [Fact]
    public async Task The_breakdown_groups_by_type_status_and_category_with_others_for_deleted_articles()
    {
        const int year = 2011;
        var admin = await factory.CreateClientAsync("admin");
        var brik = await factory.ArticleIdAsync("Brik");   // catégorie « Entrées »
        var cache = await factory.ArticleIdAsync("Caché"); // catégorie « Archive »
        await SeedAsync(At(year, 6, 2), [new Line(brik, "Brik", 4m, 3), new Line(null, "Supprimé", 2m, 5)], type: TypeCommande.SurPlace);
        await SeedAsync(At(year, 6, 3), [new Line(cache, "Caché", 10m, 1)], type: TypeCommande.Livraison);
        await SeedAsync(At(year, 6, 4), [new Line(brik, "Brik", 4m, 50)], statut: StatutCommande.Annulee, type: TypeCommande.Livraison);

        var fr = await Json(await admin.GetAsync($"api/admin/statistiques/repartition?{Period(year)}"));

        var types = fr.GetProperty("parType").EnumerateArray().ToList();
        Assert.Equal(3, types.Count);
        Assert.Equal(22m, types.Single(t => t.GetProperty("type").GetString() == "SurPlace").GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(1, types.Single(t => t.GetProperty("type").GetString() == "Livraison").GetProperty("commandes").GetInt32()); // l'annulée est exclue
        Assert.Equal(0, types.Single(t => t.GetProperty("type").GetString() == "ARemporter").GetProperty("commandes").GetInt32());

        var statuts = fr.GetProperty("parStatut").EnumerateArray().ToList();
        Assert.Equal(5, statuts.Count);
        Assert.Equal(1, statuts.Single(s => s.GetProperty("statut").GetString() == "Annulee").GetProperty("commandes").GetInt32());
        Assert.Equal(0m, statuts.Single(s => s.GetProperty("statut").GetString() == "Annulee").GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(2, statuts.Single(s => s.GetProperty("statut").GetString() == "Terminee").GetProperty("commandes").GetInt32());

        var categories = fr.GetProperty("parCategorie").EnumerateArray().ToList();
        Assert.Equal(["Entrées", "Archive", "Autres"], categories.Select(c => c.GetProperty("nom").GetString()!).ToArray());
        Assert.Equal(12m, categories[0].GetProperty("chiffreAffaires").GetDecimal());
        Assert.Equal(JsonValueKind.Null, categories[2].GetProperty("categorieId").ValueKind);
        Assert.Equal(5, categories[2].GetProperty("quantite").GetInt32());
    }
}
