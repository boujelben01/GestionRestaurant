using System.Globalization;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.DependencyInjection;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Data.Catalogue;
using Resto.Api.Data.Demo;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Restaurant;

namespace Resto.Tests;

// EF InMemory : vérifie la lecture, la validation, la génération, le plan, l'application et le reset, PAS leur
// exécution sur PostgreSQL. Limites : pas de vraie transaction (un échec au milieu n'est pas annulé), pas de
// contraintes CHECK / index uniques / clés étrangères, pas de ON DELETE CASCADE ni SET NULL sur les lignes non
// chargées (DemoSync.ResetAsync supprime donc les dépendances explicitement), pas de xmin.
public sealed class DemoTests : IDisposable
{
    // Mot de passe de TEST uniquement (base InMemory jetable), sans rapport avec Seed:DemoPassword.
    private const string TestPassword = "Demo-Test-Passw0rd!";
    private static readonly DateTimeOffset Now = new(2026, 10, 27, 15, 30, 0, TimeSpan.Zero); // 16 h 30 à Tunis
    private static readonly TimeZoneInfo Zone = OpeningHours.TunisZone;

    private readonly ServiceProvider _provider;
    private readonly IServiceScope _scope;
    private AppDbContext Db => _scope.ServiceProvider.GetRequiredService<AppDbContext>();
    private UserManager<ApplicationUser> Users => _scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

    public DemoTests()
    {
        var services = new ServiceCollection();
        var name = Guid.NewGuid().ToString();
        services.AddLogging();
        services.AddDbContext<AppDbContext>(o => o
            .UseInMemoryDatabase(name)
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning)));
        // Mêmes options Identity que Program.cs.
        services.AddIdentityCore<ApplicationUser>(o =>
            {
                o.User.RequireUniqueEmail = true;
                o.Password.RequiredLength = 8;
            })
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<AppDbContext>();
        _provider = services.BuildServiceProvider();
        _scope = _provider.CreateScope();
    }

    public void Dispose()
    {
        _scope.Dispose();
        _provider.Dispose();
    }

    // ---------- Préparation ----------

    private async Task SeedBaseAsync(bool catalogue = true)
    {
        var roles = _scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
        await roles.CreateAsync(new IdentityRole(Roles.Admin));
        await roles.CreateAsync(new IdentityRole(Roles.Client));

        var admin = new ApplicationUser { UserName = "admin", Email = "admin@resto.local", Nom = "Administrateur" };
        Assert.True((await Users.CreateAsync(admin, TestPassword)).Succeeded);
        await Users.AddToRoleAsync(admin, Roles.Admin);

        Db.ParametresRestaurant.Add(new ParametresRestaurant
        {
            Id = 1, Nom = "Resto", Telephone = "+216 70 000 000", Email = "contact@resto.local", Adresse = "Tunis",
            FraisLivraison = 3m, MontantMinimumLivraison = 15m, CommandesOuvertes = true
        });
        // Tables du seed de développement (DbSeeder) : 1 à 6.
        Db.Tables.AddRange(Enumerable.Range(1, 6).Select(n => new RestaurantTable { Numero = n, Code = Guid.NewGuid(), Capacite = 4 }));
        await Db.SaveChangesAsync();

        if (catalogue)
        {
            await CatalogueSync.ApplyAsync(Db, CatalogueReader.Read(CatalogueReader.DefaultPath), false);
        }
        Db.ChangeTracker.Clear();
    }

    private static DemoFile ShippedFile() => DemoReader.Read(DemoReader.DefaultPath);

    private async Task<(int Code, string Output)> RunAsync(
        string json, string? password = TestPassword, string environment = "Development", DateTimeOffset? now = null, params string[] args)
    {
        var path = Path.Combine(Path.GetTempPath(), $"demo-{Guid.NewGuid():N}.json");
        await File.WriteAllTextAsync(path, json);
        try
        {
            var output = new StringWriter();
            Db.ChangeTracker.Clear();
            var code = await DemoCommand.RunAsync(["--seed-demo", .. args], Db, Users, password, environment, path, output, now ?? Now);
            Db.ChangeTracker.Clear();
            return (code, output.ToString());
        }
        finally
        {
            File.Delete(path);
        }
    }

    private static string ShippedJson() => File.ReadAllText(DemoReader.DefaultPath);

    private async Task<(int Users, int Adresses, int Favoris, int Commandes, int Lignes, int Historique)> CountsAsync() =>
        (await Db.Users.CountAsync(), await Db.Adresses.CountAsync(), await Db.Favoris.CountAsync(),
         await Db.Commandes.CountAsync(), await Db.CommandeItems.CountAsync(), await Db.HistoriqueStatuts.CountAsync());

    private async Task<DemoPlan> PlanAsync(DateTimeOffset? now = null, DemoFile? file = null) =>
        await DemoSync.PlanAsync(Db, file ?? ShippedFile(), now ?? Now);

    // ---------- Fichier livré ----------

    [Fact]
    public void The_shipped_demo_file_is_valid_and_only_references_catalogue_articles()
    {
        var demo = ShippedFile();
        var catalogue = CatalogueReader.Read(CatalogueReader.DefaultPath);
        var known = catalogue.Categories!
            .SelectMany(c => c.Articles!.Select(a => DemoValidator.Key(c.NomFr, a.NomFr)))
            .ToHashSet();

        Assert.Empty(DemoValidator.Validate(demo));
        var references = demo.Utilisateurs!.SelectMany(u => u.Favoris!.Select(f => (f.Categorie, f.Article)))
            .Concat(demo.CommandesManuelles!.SelectMany(c => c.Lignes!.Select(l => (l.Categorie, l.Article))));
        Assert.All(references, r => Assert.Contains(DemoValidator.Key(r.Categorie, r.Article), known));
        Assert.DoesNotContain("prix", ShippedJson(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void The_shipped_accounts_follow_the_naming_and_phone_rules()
    {
        var users = ShippedFile().Utilisateurs!;

        Assert.Equal(15, users.Count);
        for (var i = 0; i < users.Count; i++)
        {
            var u = users[i];
            var parts = u.Nom!.Split(' ', 2);
            var expected = RemoveAccents((parts[1] + parts[0]).Replace(" ", "").ToLowerInvariant()) + "@test.com";
            Assert.Equal(expected, u.Email);
            Assert.Matches("^[a-z]+@test\\.com$", u.Email!);
            Assert.Equal($"+2162000{i + 1:D4}", u.Telephone);
            Assert.Equal(i != 14, u.Actif);
            Assert.InRange(u.Adresses!.Count, 1, 2);
            Assert.Single(u.Adresses, a => a.ParDefaut == true);
            Assert.InRange(u.Favoris!.Count, 3, 8);
            Assert.InRange(u.CreeIlYaJours!.Value, 1, 90);
        }
        Assert.Equal(users.Count, users.Select(u => u.Email).Distinct(StringComparer.OrdinalIgnoreCase).Count());
        Assert.Equal("Mehdi Rezgui", users[14].Nom);
    }

    [Fact]
    public void The_shipped_manual_orders_cover_every_status_and_type()
    {
        var manuelles = ShippedFile().CommandesManuelles!;

        Assert.Equal(8, manuelles.Count);
        Assert.Equal(Enum.GetNames<StatutCommande>().Order(), manuelles.Select(m => m.Statut!).Distinct().Order());
        Assert.Equal(Enum.GetNames<TypeCommande>().Order(), manuelles.Select(m => m.Type!).Distinct().Order());
    }

    private static string RemoveAccents(string value)
    {
        var builder = new StringBuilder();
        foreach (var c in value.Normalize(NormalizationForm.FormD))
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark) builder.Append(c);
        }
        return builder.ToString().Normalize(NormalizationForm.FormC);
    }

    // ---------- Validation du fichier ----------

    [Theory]
    [InlineData("\"email\": \"mejrisana@test.com\"", "\"email\": \"TrikiHedi@test.com\"", "en double")]
    [InlineData("\"commandesParJour\": { \"min\": 15, \"max\": 30 }", "\"commandesParJour\": { \"min\": 30, \"max\": 15 }", "incohérent")]
    [InlineData("\"ARemporter\": 45", "\"ARemporter\": 50", "somme")]
    [InlineData("\"pourcentageAnnulees\": 8", "\"pourcentageAnnulees\": 120", "pourcentageAnnulees")]
    [InlineData("\"quantiteMax\": 3", "\"quantiteMax\": 0", "quantiteMax")]
    [InlineData("\"telephone\": \"+21620000002\"", "\"telephone\": \"+21698000002\"", "+2162000")]
    [InlineData("\"utilisateur\": \"u03\"", "\"utilisateur\": \"u99\"", "inconnu")]
    [InlineData("\"utilisateur\": \"u08\"", "\"utilisateur\": \"u15\"", "inactif")]
    [InlineData("\"ilYaJours\": 0, \"heure\": \"12:30\"", "\"ilYaJours\": 4, \"heure\": \"12:30\"", "aujourd'hui")]
    [InlineData("\"heure\": \"13:05\"", "\"heure\": \"25:05\"", "heure")]
    [InlineData("\"adresse\": \"Travail\"", "\"adresse\": \"Plage\"", "introuvable")]
    [InlineData("\"statut\": \"Annulee\", \"paye\": false", "\"statut\": \"Annulee\", \"paye\": true", "annulée")]
    public void Validate_rejects_inconsistent_files(string find, string replace, string expected)
    {
        var json = ShippedJson();
        Assert.Contains(find, json);

        var errors = DemoValidator.Validate(DemoReader.Parse(json.Replace(find, replace)));

        Assert.Contains(errors, e => e.Contains(expected, StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Read_reports_malformed_json_and_missing_file()
    {
        Assert.Throws<DemoException>(() => DemoReader.Parse("{ pas du json"));
        Assert.Throws<DemoException>(() => DemoReader.Read(Path.Combine(Path.GetTempPath(), "inexistant-demo.json")));
    }

    // ---------- Références à la base ----------

    [Fact]
    public async Task Unknown_articles_and_missing_tables_are_all_reported_and_nothing_is_written()
    {
        await SeedBaseAsync();
        var json = ShippedJson()
            .Replace("\"article\": \"Pizza 4 fromages\" }", "\"article\": \"Pizza ananas\" }")
            .Replace("\"table\": 5", "\"table\": 42");
        var before = await CountsAsync();

        var (code, output) = await RunAsync(json, args: ["--apply"]);

        Assert.Equal(1, code);
        Assert.Contains("Pizza ananas", output);
        Assert.Contains("introuvable", output);
        Assert.Contains("table n°42 inexistante", output);
        Assert.Equal(before, await CountsAsync());
    }

    [Fact]
    public async Task An_empty_catalogue_stops_the_command_with_a_clear_message()
    {
        await SeedBaseAsync(catalogue: false);

        var (code, output) = await RunAsync(ShippedJson());

        Assert.Equal(1, code);
        Assert.Contains("aucun article actif", output);
    }

    // ---------- Génération ----------

    [Fact]
    public async Task Generation_is_deterministic_for_the_same_seed_and_reference_time()
    {
        await SeedBaseAsync();

        var first = await PlanAsync();
        var second = await PlanAsync();

        Assert.True(first.IsValid, string.Join("\n", first.Errors));
        Assert.NotEmpty(first.Orders);
        Assert.Equal(Serialize(first.Orders), Serialize(second.Orders));

        var otherSeed = DemoReader.Parse(ShippedJson().Replace("20261027", "12345"));
        Assert.NotEqual(Serialize(first.Orders), Serialize((await PlanAsync(file: otherSeed)).Orders));
    }

    private static string Serialize(IEnumerable<GeneratedOrder> orders) => JsonSerializer.Serialize(orders);

    [Fact]
    public void The_random_generator_is_stable_across_runtimes()
    {
        // Valeurs de référence SplitMix64 (graine 1234567) : changer l'algorithme changerait toutes les données de démo.
        var rng = new DemoRandom(1234567);
        Assert.Equal(6457827717110365317UL, rng.NextUInt64());
        Assert.Equal(3203168211198807973UL, rng.NextUInt64());
    }

    [Fact]
    public async Task Generated_orders_follow_the_domain_rules()
    {
        await SeedBaseAsync();
        var plan = await PlanAsync();
        var articles = await Db.Articles.AsNoTracking().ToDictionaryAsync(a => a.Id);
        var activeTables = await Db.Tables.Where(t => t.EstActive).Select(t => t.Id).ToListAsync();
        var file = ShippedFile();
        var today = DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(Now, Zone).DateTime);

        Assert.True(plan.IsValid);
        foreach (var o in plan.Orders)
        {
            // Totaux : même calcul que CommandeService, prix actuel de l'article.
            var totals = CommandeRules.ComputeTotals(o.Lignes.Select(l => (l.PrixUnitaire, l.Quantite)), o.Type, 3m, 15m);
            Assert.Equal((totals.SousTotal, totals.FraisLivraison, totals.Total), (o.SousTotal, o.FraisLivraison, o.Total));
            Assert.Equal(o.SousTotal + o.FraisLivraison, o.Total);
            Assert.All(o.Lignes, l =>
            {
                Assert.Equal(articles[l.ArticleId].Prix, l.PrixUnitaire);
                Assert.True(articles[l.ArticleId].EstActif && articles[l.ArticleId].EstDisponible);
                Assert.InRange(l.Quantite, 1, o.Manuelle ? 20 : 3);
            });
            Assert.Equal(o.Lignes.Count, o.Lignes.Select(l => l.ArticleId).Distinct().Count());

            // Forme selon le type (contraintes CK_Commandes_*).
            Assert.Equal(o.Type == TypeCommande.SurPlace, o.TableId is not null);
            Assert.Equal(o.Type == TypeCommande.Livraison, o.Adresse is not null);
            if (o.TableId is { } tableId) Assert.Contains(tableId, activeTables);
            if (o.Type == TypeCommande.Livraison) Assert.True(o.SousTotal >= 15m);

            // Historique : transitions valides, horodatages strictement croissants, jamais dans le futur.
            Assert.Equal(StatutCommande.EnAttente, o.Historique[0].Statut);
            Assert.Equal(o.DateCommande, o.Historique[0].Date);
            Assert.Equal(o.Statut, o.Historique[^1].Statut);
            for (var i = 1; i < o.Historique.Count; i++)
            {
                Assert.True(StatutTransitions.CanTransition(o.Historique[i - 1].Statut, o.Historique[i].Statut));
                Assert.True(o.Historique[i].Date > o.Historique[i - 1].Date);
            }
            Assert.True(o.DateMiseAJour <= Now.UtcDateTime);

            // Passées : Terminee payée ou Annulee non payée ; actives seulement aujourd'hui.
            if (o.Statut == StatutCommande.Terminee && !o.Manuelle) Assert.True(o.EstPayee);
            if (o.Statut == StatutCommande.Annulee) Assert.False(o.EstPayee);
            if (!StatutTransitions.IsFinal(o.Statut))
            {
                Assert.Equal(today, DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(o.DateCommande, Zone)));
            }

            // Client actif et déjà inscrit à la date de la commande.
            var account = plan.Accounts.Single(a => a.Cle == o.ClientCle);
            Assert.True(account.Actif);
            Assert.True(account.DateCreation <= o.DateCommande);
        }

        var actives = plan.Orders.Where(o => !o.Manuelle && !StatutTransitions.IsFinal(o.Statut)).ToList();
        Assert.Equal(4, actives.Count(o => o.Statut == StatutCommande.EnAttente));
        Assert.Equal(3, actives.Count(o => o.Statut == StatutCommande.EnPreparation));
        Assert.Equal(2, actives.Count(o => o.Statut == StatutCommande.Prete));
        Assert.Contains(actives, o => o.Type == TypeCommande.SurPlace);
        Assert.Equal(8, plan.Orders.Count(o => o.Manuelle));
        Assert.DoesNotContain(plan.Orders, o => o.ClientCle == "u15");
        Assert.InRange(plan.Orders.Count(o => o.Statut == StatutCommande.Annulee) * 100.0 / plan.Orders.Count, 3, 15);
        Assert.Equal(file.Reglages!.Jours, plan.Au.DayNumber - plan.Du.DayNumber + 1);
    }

    [Theory]
    [InlineData(5, 0)]   // 6 h à Tunis : les commandes manuelles actives de midi sont ramenées avant maintenant
    [InlineData(10, 45)] // 11 h 45 à Tunis
    [InlineData(22, 50)] // 23 h 50 à Tunis
    public async Task No_order_is_ever_in_the_future(int hour, int minute)
    {
        await SeedBaseAsync();
        var now = new DateTimeOffset(2026, 10, 27, hour, minute, 0, TimeSpan.Zero);

        var plan = await PlanAsync(now);

        Assert.True(plan.IsValid, string.Join("\n", plan.Errors));
        Assert.All(plan.Orders, o => Assert.All(o.Historique, h => Assert.True(h.Date <= now.UtcDateTime)));
    }

    // ---------- Commande ----------

    [Fact]
    public async Task Simulation_shows_the_plan_and_writes_nothing()
    {
        await SeedBaseAsync();
        var before = await CountsAsync();

        var (code, output) = await RunAsync(ShippedJson());

        Assert.Equal(0, code);
        Assert.Contains("SIMULATION", output);
        Assert.Contains("[à créer] trikihedi@test.com", output);
        Assert.Contains("Par statut", output);
        Assert.Contains("Par type", output);
        Assert.Contains("Chiffre d'affaires", output);
        Assert.DoesNotContain(TestPassword, output);
        Assert.Equal(before, await CountsAsync());
    }

    [Fact]
    public async Task Apply_creates_everything_and_is_idempotent()
    {
        await SeedBaseAsync();
        var plan = await PlanAsync();

        var (code, output) = await RunAsync(ShippedJson(), args: ["--apply"]);

        Assert.Equal(0, code);
        Assert.Contains("APPLIQUÉ", output);
        Assert.DoesNotContain(TestPassword, output);
        var after = await CountsAsync();
        Assert.Equal(16, after.Users); // admin + 15 comptes de démo
        Assert.Equal(plan.Orders.Count, after.Commandes);
        Assert.Equal(plan.Orders.Sum(o => o.Lignes.Count), after.Lignes);
        Assert.Equal(plan.Orders.Sum(o => o.Historique.Count), after.Historique);

        var hedi = (await Users.FindByEmailAsync("trikihedi@test.com"))!;
        Assert.Equal(new[] { Roles.Client }, await Users.GetRolesAsync(hedi));
        Assert.True(await Users.CheckPasswordAsync(hedi, TestPassword));
        Assert.Equal("+21620000001", hedi.PhoneNumber);
        Assert.False((await Users.FindByEmailAsync("rezguimehdi@test.com"))!.EstActif);
        Assert.Single(await Db.Adresses.Where(a => a.UserId == hedi.Id && a.EstParDefaut).ToListAsync());
        Assert.Single(await Users.GetUsersInRoleAsync(Roles.Admin));

        var numeros = await Db.Commandes.Select(c => c.Numero).ToListAsync();
        Assert.All(numeros, n => Assert.Matches("^CMD-\\d{6}$", n));
        Assert.Equal(numeros.Count, numeros.Distinct().Count());
        var sansAuteur = await Db.HistoriqueStatuts.CountAsync(h => h.ParUserId == null);
        Assert.True(sansAuteur > 0);

        var (again, secondOutput) = await RunAsync(ShippedJson(), args: ["--apply"]);

        Assert.Equal(0, again);
        Assert.Contains("partie commandes est ignorée", secondOutput);
        Assert.Contains("[existe déjà] trikihedi@test.com", secondOutput);
        Assert.Equal(after, await CountsAsync());
    }

    [Fact]
    public async Task An_existing_non_demo_account_with_a_demo_email_is_a_conflict()
    {
        await SeedBaseAsync();
        var real = new ApplicationUser { UserName = "trikihedi@test.com", Email = "trikihedi@test.com", PhoneNumber = "+21698765432", Nom = "Vrai Hedi" };
        Assert.True((await Users.CreateAsync(real, TestPassword)).Succeeded);
        var before = await CountsAsync();

        var simulation = await RunAsync(ShippedJson());
        var apply = await RunAsync(ShippedJson(), args: ["--apply"]);

        Assert.Equal(1, simulation.Code);
        Assert.Contains("Conflit", simulation.Output);
        Assert.Equal(1, apply.Code);
        Assert.Contains("Conflit", apply.Output);
        Assert.Equal(before, await CountsAsync());
        Assert.Equal("+21698765432", (await Users.FindByEmailAsync("trikihedi@test.com"))!.PhoneNumber);
    }

    [Fact]
    public async Task Reset_only_removes_demo_accounts_and_their_data()
    {
        await SeedBaseAsync();
        Assert.Equal(0, (await RunAsync(ShippedJson(), args: ["--apply"])).Code);

        // Vrai compte en @test.com (e-mail hors de demo.json, autre téléphone) avec adresse, favori et une vraie commande.
        var real = new ApplicationUser { UserName = "benalisalma@test.com", Email = "benalisalma@test.com", PhoneNumber = "+21655123456", Nom = "Salma Ben Ali" };
        Assert.True((await Users.CreateAsync(real, TestPassword)).Succeeded);
        await Users.AddToRoleAsync(real, Roles.Client);
        // Compte qui a le préfixe de démo mais un e-mail absent du fichier : pas de démo non plus.
        var prefixOnly = new ApplicationUser { UserName = "autre@test.com", Email = "autre@test.com", PhoneNumber = "+21620000099", Nom = "Autre" };
        Assert.True((await Users.CreateAsync(prefixOnly, TestPassword)).Succeeded);
        var article = await Db.Articles.FirstAsync();
        var now = Now.UtcDateTime;
        Db.Adresses.Add(new Adresse { UserId = real.Id, Libelle = "Maison", Ligne = "1 rue Réelle", Ville = "Tunis", Telephone = "+21655123456", EstParDefaut = true });
        Db.Favoris.Add(new Favori { UserId = real.Id, ArticleId = article.Id });
        Db.Commandes.Add(new Commande
        {
            Numero = "CMD-999999", UserId = real.Id, NomClient = "Salma Ben Ali", Telephone = "+21655123456",
            Statut = StatutCommande.EnAttente, TypeCommande = TypeCommande.ARemporter, SousTotal = article.Prix, Total = article.Prix,
            DateCommande = now, DateMiseAJour = now,
            Items = [new CommandeItem { ArticleId = article.Id, NomFr = article.NomFr, PrixUnitaire = article.Prix, Quantite = 1 }],
            Historique = [new HistoriqueStatut { Statut = StatutCommande.EnAttente, Date = now, ParUserId = real.Id }]
        });
        await Db.SaveChangesAsync();
        Db.ChangeTracker.Clear();
        var withDemo = await CountsAsync();

        var simulation = await RunAsync(ShippedJson(), args: ["--reset-demo"]);
        Assert.Equal(0, simulation.Code);
        Assert.Contains("SIMULATION", simulation.Output);
        Assert.Contains("15 compte(s)", simulation.Output);
        Assert.Equal(withDemo, await CountsAsync());

        var (code, output) = await RunAsync(ShippedJson(), password: null, args: ["--reset-demo", "--apply"]);

        Assert.Equal(0, code);
        Assert.Contains("Supprimé", output);
        Assert.Equal(new[] { "admin", "autre@test.com", "benalisalma@test.com" },
            await Db.Users.OrderBy(u => u.UserName).Select(u => u.UserName!).ToListAsync());
        Assert.Equal("CMD-999999", (await Db.Commandes.SingleAsync()).Numero);
        Assert.Equal(1, await Db.CommandeItems.CountAsync());
        Assert.Equal(1, await Db.HistoriqueStatuts.CountAsync());
        Assert.Equal(real.Id, (await Db.Adresses.SingleAsync()).UserId);
        Assert.Equal(real.Id, (await Db.Favoris.SingleAsync()).UserId);
        Assert.Equal(2, await Db.UserRoles.CountAsync()); // admin (Admin) et Salma (Client)
        Assert.True(await Users.IsInRoleAsync((await Users.FindByNameAsync("admin"))!, Roles.Admin));
        Assert.NotEmpty(await Db.Articles.ToListAsync());
        Assert.Equal(6, await Db.Tables.CountAsync());
        Assert.Equal(1, await Db.ParametresRestaurant.CountAsync());
    }

    [Fact]
    public async Task The_command_refuses_to_run_without_the_demo_password()
    {
        await SeedBaseAsync();

        var missing = await RunAsync(ShippedJson(), password: null, args: ["--apply"]);
        var weak = await RunAsync(ShippedJson(), password: "court", args: ["--apply"]);

        Assert.Equal(1, missing.Code);
        Assert.Contains("Seed:DemoPassword est absent", missing.Output);
        Assert.Equal(1, weak.Code);
        Assert.Contains("règles Identity", weak.Output);
        Assert.DoesNotContain("court", weak.Output);
        Assert.Equal(1, await Db.Users.CountAsync());
    }

    [Fact]
    public async Task The_command_refuses_production_without_the_explicit_flag()
    {
        await SeedBaseAsync();

        var refused = await RunAsync(ShippedJson(), environment: "Production", args: ["--apply"]);
        var allowed = await RunAsync(ShippedJson(), environment: "Production", args: ["--allow-production"]);

        Assert.Equal(1, refused.Code);
        Assert.Contains("Production", refused.Output);
        Assert.Equal(1, await Db.Users.CountAsync());
        Assert.Equal(0, allowed.Code);
        Assert.Contains("SIMULATION", allowed.Output);
    }

    [Fact]
    public async Task Unknown_options_are_rejected()
    {
        var (code, output) = await RunAsync(ShippedJson(), args: ["--force"]);

        Assert.Equal(2, code);
        Assert.Contains("--force", output);
    }
}
