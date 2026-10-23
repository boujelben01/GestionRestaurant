using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Tests;

// Limites de l'EF InMemory : pas de vrai xmin (Version reste à 0 et n'est jamais incrémentée), donc la
// détection de modification concurrente par le moteur SQL N'EST PAS exercée ici ; seule la comparaison
// explicite de `version` l'est. Pas non plus de CHECK ni d'index uniques PostgreSQL, ni de vraie transaction.
public class AdminCommandesApiTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Phone = "+21620123456";

    public Task InitializeAsync() => factory.ResetRestaurantAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static Task<HttpResponseMessage> Patch(HttpClient client, string url, object body) =>
        client.PatchAsJsonAsync(url, body);

    private static Task<HttpResponseMessage> SetStatut(HttpClient admin, int id, string statut, uint? version = null) =>
        Patch(admin, $"api/admin/commandes/{id}/statut", version is null ? new { statut } : new { statut, version });

    /// <summary>Crée une commande à emporter par un nouveau client, via l'API publique.</summary>
    private async Task<(HttpClient Client, int Id)> OrderAsync()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var brik = await factory.ArticleIdAsync("Brik");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("api/panier/items", new { articleId = brik, quantite = 2 })).StatusCode);
        var response = await client.PostAsJsonAsync("api/commandes", new { typeCommande = "ARemporter", telephone = Phone, note = "sans harissa" });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (client, (await Json(response)).GetProperty("id").GetInt32());
    }

    /// <summary>Insère directement une commande (filtres, compteurs, plafond) sans passer par le panier.</summary>
    private async Task<int> SeedAsync(
        StatutCommande statut = StatutCommande.EnAttente,
        TypeCommande type = TypeCommande.ARemporter,
        bool estPayee = false,
        DateTime? date = null,
        string nom = "client-seed",
        string telephone = Phone)
    {
        await factory.CreateClientAsync(); // garantit le seed du catalogue
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var when = date ?? DateTime.UtcNow;
        var commande = new Commande
        {
            Numero = "SEED-" + Guid.NewGuid().ToString("N")[..10],
            NomClient = nom,
            Telephone = telephone,
            Statut = statut,
            TypeCommande = type,
            EstPayee = estPayee,
            SousTotal = 7m,
            Total = 7m,
            DateCommande = when,
            DateMiseAJour = when,
            Items = [new CommandeItem { NomFr = "Brik", NomAr = "بريك", PrixUnitaire = 3.5m, Quantite = 2 }],
            Historique = [new HistoriqueStatut { Statut = statut, Date = when }]
        };
        db.Commandes.Add(commande);
        await db.SaveChangesAsync();
        return commande.Id;
    }

    private static string[] Statuts(JsonElement history) =>
        history.EnumerateArray().Select(h => h.GetProperty("statut").GetString()!).ToArray();

    // ---------- Accès ----------

    public static TheoryData<string, string> AdminRoutes => new()
    {
        { "GET", "api/admin/commandes" },
        { "GET", "api/admin/commandes/1" },
        { "GET", "api/admin/commandes/actives" },
        { "GET", "api/admin/commandes/compteurs" },
        { "PATCH", "api/admin/commandes/1/statut" },
        { "PATCH", "api/admin/commandes/1/paiement" }
    };

    private static HttpRequestMessage Request(string method, string url) =>
        new(new HttpMethod(method), url) { Content = method == "PATCH" ? JsonContent.Create(new { statut = "EnPreparation", estPayee = true }) : null };

    [Theory]
    [MemberData(nameof(AdminRoutes))]
    public async Task Admin_order_routes_return_401_without_token(string method, string url)
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(Request(method, url))).StatusCode);
    }

    [Theory]
    [MemberData(nameof(AdminRoutes))]
    public async Task Admin_order_routes_return_403_for_a_client(string method, string url)
    {
        var client = await factory.CreateClientAsync("client");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(Request(method, url))).StatusCode);
    }

    [Fact]
    public async Task Admin_can_list_orders()
    {
        var admin = await factory.CreateClientAsync("admin");

        var page = await Json(await admin.GetAsync("api/admin/commandes?pageSize=500"));

        Assert.Equal(50, page.GetProperty("pageSize").GetInt32());
    }

    // ---------- Cycle de vie ----------

    [Fact]
    public async Task An_order_goes_through_the_whole_lifecycle_with_an_author_on_every_history_line()
    {
        var admin = await factory.CreateClientAsync("admin");
        var adminId = await factory.GetUserIdAsync("admin");
        var (_, id) = await OrderAsync();

        foreach (var statut in new[] { "EnPreparation", "Prete", "Terminee" })
        {
            var response = await SetStatut(admin, id, statut);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
            Assert.Equal(statut, (await Json(response)).GetProperty("statut").GetString());
        }

        var detail = await Json(await admin.GetAsync($"api/admin/commandes/{id}"));
        var history = detail.GetProperty("historique");
        Assert.Equal(["EnAttente", "EnPreparation", "Prete", "Terminee"], Statuts(history));
        Assert.All(history.EnumerateArray(), h => Assert.False(string.IsNullOrEmpty(h.GetProperty("parUserId").GetString())));
        // Création : le client lui-même ; changements suivants : l'admin, avec son nom.
        Assert.NotEqual(adminId, history[0].GetProperty("parUserId").GetString());
        foreach (var index in new[] { 1, 2, 3 })
        {
            Assert.Equal(adminId, history[index].GetProperty("parUserId").GetString());
            Assert.Equal("admin", history[index].GetProperty("parNom").GetString());
        }

        Assert.Empty(detail.GetProperty("statutsSuivants").EnumerateArray());
    }

    [Fact]
    public async Task Detail_exposes_customer_lines_totals_and_next_statuses_without_identity_data()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();

        var response = await admin.GetAsync($"api/admin/commandes/{id}");
        var raw = await response.Content.ReadAsStringAsync();
        var detail = JsonDocument.Parse(raw).RootElement;

        Assert.Equal("EnAttente", detail.GetProperty("statut").GetString());
        Assert.Equal(Phone, detail.GetProperty("client").GetProperty("telephone").GetString());
        Assert.False(string.IsNullOrEmpty(detail.GetProperty("client").GetProperty("nom").GetString()));
        var ligne = Assert.Single(detail.GetProperty("lignes").EnumerateArray());
        Assert.Equal("Brik", ligne.GetProperty("nomFr").GetString());
        Assert.Equal("بريك", ligne.GetProperty("nomAr").GetString());
        Assert.Equal(7m, detail.GetProperty("sousTotal").GetDecimal());
        Assert.Equal("sans harissa", detail.GetProperty("note").GetString());
        Assert.Equal(["EnPreparation", "Annulee"], detail.GetProperty("statutsSuivants").EnumerateArray().Select(s => s.GetString()!).ToArray());
        Assert.True(detail.TryGetProperty("version", out _));
        foreach (var forbidden in new[] { "passwordHash", "securityStamp", "concurrencyStamp", "normalizedEmail", "@resto.local" })
        {
            Assert.DoesNotContain(forbidden, raw, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task A_forbidden_transition_returns_409_and_changes_nothing()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();

        var response = await SetStatut(admin, id, "Terminee");

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("EnAttente -> Terminee n'est pas autorisé", (await Json(response)).GetProperty("title").GetString());
        var detail = await Json(await admin.GetAsync($"api/admin/commandes/{id}"));
        Assert.Equal("EnAttente", detail.GetProperty("statut").GetString());
        Assert.Equal(1, detail.GetProperty("historique").GetArrayLength());
    }

    [Fact]
    public async Task Asking_for_the_current_status_again_is_idempotent_and_writes_no_history()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();

        Assert.Equal(HttpStatusCode.OK, (await SetStatut(admin, id, "EnPreparation")).StatusCode);
        var again = await SetStatut(admin, id, "EnPreparation");

        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.Equal(["EnAttente", "EnPreparation"], Statuts((await Json(again)).GetProperty("historique")));
    }

    [Theory]
    [InlineData(0)] // annulée dès EnAttente
    [InlineData(1)] // après EnPreparation
    [InlineData(2)] // après Prete
    public async Task An_admin_can_cancel_at_every_active_stage_and_the_order_never_comes_back(int stagesBefore)
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();
        foreach (var statut in new[] { "EnPreparation", "Prete" }.Take(stagesBefore))
        {
            Assert.Equal(HttpStatusCode.OK, (await SetStatut(admin, id, statut)).StatusCode);
        }

        var cancelled = await SetStatut(admin, id, "Annulee");

        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        var detail = await Json(cancelled);
        Assert.Equal("Annulee", detail.GetProperty("statut").GetString());
        Assert.Equal(stagesBefore + 2, detail.GetProperty("historique").GetArrayLength());
        Assert.Equal("Annulee", Statuts(detail.GetProperty("historique")).Last());
        foreach (var back in new[] { "EnAttente", "EnPreparation", "Prete", "Terminee" })
        {
            Assert.Equal(HttpStatusCode.Conflict, (await SetStatut(admin, id, back)).StatusCode);
        }
    }

    [Fact]
    public async Task A_finished_order_cannot_be_modified()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();
        foreach (var statut in new[] { "EnPreparation", "Prete", "Terminee" })
        {
            await SetStatut(admin, id, statut);
        }

        foreach (var target in new[] { "EnAttente", "EnPreparation", "Prete", "Annulee" })
        {
            Assert.Equal(HttpStatusCode.Conflict, (await SetStatut(admin, id, target)).StatusCode);
        }

        Assert.Equal(HttpStatusCode.OK, (await SetStatut(admin, id, "Terminee")).StatusCode); // idempotent
    }

    // ---------- Saisies invalides ----------

    [Theory]
    [InlineData("{\"statut\":\"Inconnu\"}")]
    [InlineData("{\"statut\":3}")]
    [InlineData("{\"statut\":null}")]
    [InlineData("{}")]
    [InlineData("{\"statut\":\"EnPreparation\",\"version\":\"abc\"}")]
    public async Task An_invalid_status_body_returns_400(string body)
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();

        var response = await admin.PatchAsync($"api/admin/commandes/{id}/statut", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task An_unknown_order_returns_404()
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("api/admin/commandes/999999")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SetStatut(admin, 999999, "EnPreparation")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Patch(admin, "api/admin/commandes/999999/paiement", new { estPayee = true })).StatusCode);
    }

    // ---------- Concurrence ----------

    [Fact]
    public async Task A_stale_version_returns_409_and_a_matching_one_is_accepted()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();
        var version = (await Json(await admin.GetAsync($"api/admin/commandes/{id}"))).GetProperty("version").GetUInt32();

        var stale = await SetStatut(admin, id, "EnPreparation", version + 7);
        Assert.Equal(HttpStatusCode.Conflict, stale.StatusCode);
        Assert.Contains("modifiée entre-temps", (await Json(stale)).GetProperty("title").GetString());
        Assert.Equal("EnAttente", (await Json(await admin.GetAsync($"api/admin/commandes/{id}"))).GetProperty("statut").GetString());

        Assert.Equal(HttpStatusCode.OK, (await SetStatut(admin, id, "EnPreparation", version)).StatusCode);
    }

    // ---------- Paiement ----------

    [Fact]
    public async Task Payment_can_be_set_and_unset_and_is_idempotent()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();

        var paid = await Patch(admin, $"api/admin/commandes/{id}/paiement", new { estPayee = true });
        Assert.Equal(HttpStatusCode.OK, paid.StatusCode);
        Assert.True((await Json(paid)).GetProperty("estPayee").GetBoolean());
        Assert.Equal(HttpStatusCode.OK, (await Patch(admin, $"api/admin/commandes/{id}/paiement", new { estPayee = true })).StatusCode);

        var unpaid = await Patch(admin, $"api/admin/commandes/{id}/paiement", new { estPayee = false });
        Assert.False((await Json(unpaid)).GetProperty("estPayee").GetBoolean());
    }

    [Fact]
    public async Task Payment_is_allowed_on_a_finished_order_but_refused_on_a_cancelled_one()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, finished) = await OrderAsync();
        foreach (var statut in new[] { "EnPreparation", "Prete", "Terminee" })
        {
            await SetStatut(admin, finished, statut);
        }

        Assert.Equal(HttpStatusCode.OK, (await Patch(admin, $"api/admin/commandes/{finished}/paiement", new { estPayee = true })).StatusCode);

        var (_, cancelled) = await OrderAsync();
        await SetStatut(admin, cancelled, "Annulee");
        Assert.Equal(HttpStatusCode.Conflict, (await Patch(admin, $"api/admin/commandes/{cancelled}/paiement", new { estPayee = true })).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await Patch(admin, $"api/admin/commandes/{cancelled}/paiement", new { estPayee = false })).StatusCode);
    }

    [Fact]
    public async Task Payment_requires_a_value()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (_, id) = await OrderAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await Patch(admin, $"api/admin/commandes/{id}/paiement", new { })).StatusCode);
    }

    // ---------- Liste : filtres et pagination ----------

    [Fact]
    public async Task The_list_filters_by_status_type_payment_and_search_and_orders_newest_first()
    {
        var admin = await factory.CreateClientAsync("admin");
        var tag = "flt" + Guid.NewGuid().ToString("N")[..8];
        var now = DateTime.UtcNow;
        var oldest = await SeedAsync(StatutCommande.EnAttente, TypeCommande.ARemporter, false, now.AddMinutes(-30), tag + "-alice", "+21611111111");
        var middle = await SeedAsync(StatutCommande.EnPreparation, TypeCommande.Livraison, true, now.AddMinutes(-20), tag + "-bob", "+21622222222");
        var newest = await SeedAsync(StatutCommande.Terminee, TypeCommande.ARemporter, true, now.AddMinutes(-10), tag + "-chloé", "+21633333333");

        async Task<int[]> Ids(string query) =>
            (await Json(await admin.GetAsync($"api/admin/commandes?recherche={tag}{query}")))
                .GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).ToArray();

        Assert.Equal([newest, middle, oldest], await Ids(""));
        Assert.Equal([middle], await Ids("&statut=EnPreparation"));
        Assert.Equal([newest, oldest], (await Ids("&statut=EnAttente&statut=Terminee")).OrderByDescending(x => x).ToArray());
        Assert.Equal([newest, middle], await Ids("&statut=EnPreparation,Terminee"));
        Assert.Equal([middle], await Ids("&typeCommande=Livraison"));
        Assert.Equal([newest, oldest], await Ids("&typeCommande=ARemporter"));
        Assert.Equal([newest, middle], await Ids("&estPayee=true"));
        Assert.Equal([oldest], await Ids("&estPayee=false"));
        Assert.Equal([middle], await Ids("&statut=enpreparation")); // insensible à la casse
    }

    [Fact]
    public async Task Search_matches_number_name_and_phone_case_insensitively()
    {
        var admin = await factory.CreateClientAsync("admin");
        var tag = "Srch" + Guid.NewGuid().ToString("N")[..8];
        var id = await SeedAsync(nom: tag + " Dupont", telephone: "+21699887766");
        using var scope = factory.Services.CreateScope();
        var numero = (await scope.ServiceProvider.GetRequiredService<AppDbContext>().Commandes.SingleAsync(c => c.Id == id)).Numero;

        foreach (var term in new[] { tag.ToUpperInvariant(), tag.ToLowerInvariant(), "dupont", "99887766", numero.ToLowerInvariant() })
        {
            var items = (await Json(await admin.GetAsync($"api/admin/commandes?recherche={Uri.EscapeDataString(term)}"))).GetProperty("items");
            Assert.Contains(items.EnumerateArray(), i => i.GetProperty("id").GetInt32() == id);
        }

        var none = await Json(await admin.GetAsync($"api/admin/commandes?recherche={tag}-introuvable"));
        Assert.Equal(0, none.GetProperty("total").GetInt32());
    }

    [Fact]
    public async Task The_list_filters_by_date_with_inclusive_bounds()
    {
        var admin = await factory.CreateClientAsync("admin");
        var tag = "dat" + Guid.NewGuid().ToString("N")[..8];
        var d1 = await SeedAsync(nom: tag, date: new DateTime(2020, 1, 10, 0, 0, 0, DateTimeKind.Utc));   // début de journée
        var d2 = await SeedAsync(nom: tag, date: new DateTime(2020, 1, 10, 23, 59, 59, DateTimeKind.Utc)); // fin de journée
        var d3 = await SeedAsync(nom: tag, date: new DateTime(2020, 1, 11, 0, 0, 0, DateTimeKind.Utc));   // lendemain 00:00

        async Task<int[]> Ids(string query) =>
            (await Json(await admin.GetAsync($"api/admin/commandes?recherche={tag}&{query}")))
                .GetProperty("items").EnumerateArray().Select(i => i.GetProperty("id").GetInt32()).OrderBy(x => x).ToArray();

        // Date seule : le jour entier est inclus aux deux bornes.
        Assert.Equal([d1, d2], await Ids("du=2020-01-10&au=2020-01-10"));
        Assert.Equal([d1, d2, d3], await Ids("du=2020-01-10&au=2020-01-11"));
        Assert.Equal([d3], await Ids("du=2020-01-11"));
        Assert.Equal([d1, d2], await Ids("au=2020-01-10"));
        // Date-heure : bornes incluses à la seconde près.
        Assert.Equal([d2], await Ids("du=2020-01-10T23:59:59Z&au=2020-01-10T23:59:59Z"));
        Assert.Equal([d1], await Ids("du=2020-01-10T00:00:00Z&au=2020-01-10T00:00:00Z"));
    }

    [Theory]
    [InlineData("statut=Inconnu")]
    [InlineData("statut=1")]
    [InlineData("typeCommande=Drive")]
    [InlineData("typeCommande=2")]
    [InlineData("du=pas-une-date")]
    [InlineData("au=2024-13-45")]
    [InlineData("du=2024-06-10&au=2024-06-01")]
    [InlineData("estPayee=peutetre")]
    [InlineData("page=abc")]
    public async Task Invalid_filters_return_400_never_500(string query)
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"api/admin/commandes?{query}")).StatusCode);
    }

    [Fact]
    public async Task The_list_is_paginated_and_the_page_size_is_capped_at_50()
    {
        var admin = await factory.CreateClientAsync("admin");
        var tag = "pag" + Guid.NewGuid().ToString("N")[..8];
        for (var i = 0; i < 5; i++)
        {
            await SeedAsync(nom: tag);
        }

        var first = await Json(await admin.GetAsync($"api/admin/commandes?recherche={tag}&pageSize=2&page=1"));
        var last = await Json(await admin.GetAsync($"api/admin/commandes?recherche={tag}&pageSize=2&page=3"));
        var capped = await Json(await admin.GetAsync($"api/admin/commandes?recherche={tag}&pageSize=999"));

        Assert.Equal(5, first.GetProperty("total").GetInt32());
        Assert.Equal(2, first.GetProperty("items").GetArrayLength());
        Assert.Equal(1, last.GetProperty("items").GetArrayLength());
        Assert.Equal(50, capped.GetProperty("pageSize").GetInt32());
        var summary = first.GetProperty("items")[0];
        foreach (var field in new[] { "id", "numero", "statut", "typeCommande", "nomClient", "telephone", "tableNumero", "total", "estPayee", "nombreArticles", "dateCommande", "dateMiseAJour" })
        {
            Assert.True(summary.TryGetProperty(field, out _), field);
        }

        Assert.Equal(2, summary.GetProperty("nombreArticles").GetInt32());
    }

    [Fact]
    public async Task A_search_term_that_is_too_long_returns_400()
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.BadRequest, (await admin.GetAsync($"api/admin/commandes?recherche={new string('x', 101)}")).StatusCode);
    }

    // ---------- Écran cuisine et compteurs ----------

    [Fact]
    public async Task Active_orders_exclude_finished_ones_oldest_first_with_their_lines()
    {
        var admin = await factory.CreateClientAsync("admin");
        var tag = "act" + Guid.NewGuid().ToString("N")[..8];
        var now = DateTime.UtcNow;
        var recent = await SeedAsync(StatutCommande.EnAttente, nom: tag, date: now.AddMinutes(-1));
        var older = await SeedAsync(StatutCommande.Prete, nom: tag, date: now.AddMinutes(-9));
        var done = await SeedAsync(StatutCommande.Terminee, nom: tag, date: now.AddMinutes(-20));
        var cancelled = await SeedAsync(StatutCommande.Annulee, nom: tag, date: now.AddMinutes(-30));

        var actives = (await Json(await admin.GetAsync("api/admin/commandes/actives"))).EnumerateArray()
            .Where(c => c.GetProperty("nomClient").GetString() == tag).ToList();

        Assert.Equal([older, recent], actives.Select(c => c.GetProperty("id").GetInt32()).ToArray());
        Assert.DoesNotContain(actives, c => c.GetProperty("id").GetInt32() == done || c.GetProperty("id").GetInt32() == cancelled);
        var ligne = Assert.Single(actives[0].GetProperty("lignes").EnumerateArray());
        Assert.Equal("Brik", ligne.GetProperty("nomFr").GetString());
        Assert.Equal(2, ligne.GetProperty("quantite").GetInt32());
    }

    [Fact]
    public async Task Counters_report_today_per_status_and_all_pending_orders()
    {
        var admin = await factory.CreateClientAsync("admin");
        var before = await Json(await admin.GetAsync("api/admin/commandes/compteurs"));
        int Of(JsonElement counters, string statut) => counters.GetProperty("parStatut").EnumerateArray()
            .Single(c => c.GetProperty("statut").GetString() == statut).GetProperty("nombre").GetInt32();

        await SeedAsync(StatutCommande.EnAttente);
        await SeedAsync(StatutCommande.EnAttente);
        await SeedAsync(StatutCommande.Terminee);
        await SeedAsync(StatutCommande.EnAttente, date: DateTime.UtcNow.AddDays(-3)); // ancienne : pas « aujourd'hui », mais en attente
        var after = await Json(await admin.GetAsync("api/admin/commandes/compteurs"));

        Assert.Equal(["EnAttente", "EnPreparation", "Prete", "Terminee", "Annulee"],
            after.GetProperty("parStatut").EnumerateArray().Select(c => c.GetProperty("statut").GetString()!).ToArray());
        Assert.Equal(Of(before, "EnAttente") + 2, Of(after, "EnAttente"));
        Assert.Equal(Of(before, "Terminee") + 1, Of(after, "Terminee"));
        Assert.Equal(before.GetProperty("totalAujourdhui").GetInt32() + 3, after.GetProperty("totalAujourdhui").GetInt32());
        Assert.Equal(before.GetProperty("enAttente").GetInt32() + 3, after.GetProperty("enAttente").GetInt32());
        Assert.Matches(@"^\d{4}-\d{2}-\d{2}$", after.GetProperty("date").GetString());
    }

    // ---------- Cohérence côté client ----------

    [Fact]
    public async Task The_client_sees_the_new_status_and_history_after_an_admin_change()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (client, id) = await OrderAsync();

        await SetStatut(admin, id, "EnPreparation");
        await SetStatut(admin, id, "Prete");

        var detail = await Json(await client.GetAsync($"api/commandes/{id}"));
        Assert.Equal("Prete", detail.GetProperty("statut").GetString());
        Assert.Equal(["EnAttente", "EnPreparation", "Prete"], Statuts(detail.GetProperty("historique")));
        var list = await Json(await client.GetAsync("api/commandes"));
        Assert.Equal("Prete", list.GetProperty("items").EnumerateArray().Single(c => c.GetProperty("id").GetInt32() == id).GetProperty("statut").GetString());
    }

    [Fact]
    public async Task The_client_can_no_longer_cancel_once_the_admin_has_taken_the_order()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (client, id) = await OrderAsync();
        await SetStatut(admin, id, "EnPreparation");

        var response = await client.PostAsync($"api/commandes/{id}/annuler", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal("EnPreparation", (await Json(await admin.GetAsync($"api/admin/commandes/{id}"))).GetProperty("statut").GetString());
    }

    [Fact]
    public async Task A_client_cancellation_is_visible_to_the_admin_and_is_final()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (client, id) = await OrderAsync();

        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"api/commandes/{id}/annuler", null)).StatusCode);

        var detail = await Json(await admin.GetAsync($"api/admin/commandes/{id}"));
        Assert.Equal("Annulee", detail.GetProperty("statut").GetString());
        Assert.Equal(["EnAttente", "Annulee"], Statuts(detail.GetProperty("historique")));
        Assert.Equal(HttpStatusCode.Conflict, (await SetStatut(admin, id, "EnPreparation")).StatusCode);
    }

    [Fact]
    public async Task A_client_cannot_read_or_change_orders_through_the_admin_routes()
    {
        var (client, id) = await OrderAsync();

        Assert.Equal(HttpStatusCode.Forbidden, (await client.GetAsync($"api/admin/commandes/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await SetStatut(client, id, "Annulee")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await Patch(client, $"api/admin/commandes/{id}/paiement", new { estPayee = true })).StatusCode);
    }
}

// Le plafond de 200 commandes actives est testé à part : il faut 201 lignes, qui fausseraient les compteurs
// et les listes des autres tests si elles partageaient la même base.
public class AdminCommandesCapTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Active_orders_are_capped_at_200()
    {
        var admin = await factory.CreateClientAsync("admin");
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var now = DateTime.UtcNow;
            for (var i = 0; i < 205; i++)
            {
                db.Commandes.Add(new Commande
                {
                    Numero = $"CAP-{i:D4}", NomClient = "cap", Telephone = "+21620000000", SousTotal = 1m, Total = 1m,
                    Statut = StatutCommande.EnAttente, DateCommande = now.AddSeconds(-i), DateMiseAJour = now
                });
            }

            await db.SaveChangesAsync();
        }

        var actives = await admin.GetFromJsonAsync<JsonElement>("api/admin/commandes/actives");

        Assert.Equal(200, actives.GetArrayLength());
        Assert.Equal("CAP-0204", actives[0].GetProperty("numero").GetString()); // la plus ancienne en premier
    }
}
