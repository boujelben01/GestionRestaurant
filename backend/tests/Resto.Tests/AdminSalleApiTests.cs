using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Resto.Tests;

// EF InMemory : pas de vrai xmin (la détection de commande modifiée entre-temps n'est pas exercée), pas de
// vraies transactions, pas de contraintes PostgreSQL.
public class AdminSalleApiTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private static int _next = 200;

    public Task InitializeAsync() => factory.ResetRestaurantAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private async Task<(int Id, Guid Code, int Numero)> NewTableAsync(HttpClient admin)
    {
        var numero = Interlocked.Increment(ref _next);
        var table = await Json(await admin.PostAsJsonAsync("api/admin/tables", new { numero, capacite = 4 }));
        return (table.GetProperty("id").GetInt32(), table.GetProperty("code").GetGuid(), numero);
    }

    /// <summary>Commande sur place d'un nouveau client à cette table (via l'API publique) ; renvoie son id.</summary>
    private async Task<(HttpClient Client, int OrderId)> OrderAtAsync(Guid code, string article = "Brik", int quantite = 2)
    {
        var client = await factory.CreateClientForNewUserAsync();
        var id = await factory.ArticleIdAsync(article);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("api/panier/items", new { articleId = id, quantite })).StatusCode);
        var response = await client.PostAsJsonAsync("api/commandes", new { typeCommande = "SurPlace", telephone = "+21620123456", tableCode = code });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (client, (await Json(response)).GetProperty("id").GetInt32());
    }

    private static async Task Advance(HttpClient admin, int orderId, params string[] statuts)
    {
        foreach (var statut in statuts)
        {
            Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"api/admin/commandes/{orderId}/statut", new { statut })).StatusCode);
        }
    }

    private static async Task<JsonElement> SalleEntryAsync(HttpClient admin, int tableId)
    {
        var salle = await Json(await admin.GetAsync("api/admin/tables/salle"));
        return salle.EnumerateArray().Single(t => t.GetProperty("id").GetInt32() == tableId);
    }

    private static string Etat(JsonElement entry) => entry.GetProperty("etat").GetString()!;

    // ---------- Accès ----------

    public static TheoryData<string, string> Routes => new()
    {
        { "GET", "api/admin/tables/salle" },
        { "POST", "api/admin/tables/1/encaisser" },
        { "POST", "api/admin/tables/1/liberer" }
    };

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Salle_routes_return_401_without_token(string method, string url)
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), url))).StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Salle_routes_return_403_for_a_client(string method, string url)
    {
        var client = await factory.CreateClientAsync("client");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), url))).StatusCode);
    }

    [Fact]
    public async Task The_admin_gets_the_floor_plan_sorted_by_table_number()
    {
        var admin = await factory.CreateClientAsync("admin");
        await NewTableAsync(admin);

        var response = await admin.GetAsync("api/admin/tables/salle");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var numeros = (await Json(response)).EnumerateArray().Select(t => t.GetProperty("numero").GetInt32()).ToList();
        Assert.Equal(numeros.OrderBy(n => n).ToList(), numeros);
        // Les tables de test (n° 1 active, n° 2 inactive) sont présentes.
        Assert.Contains(1, numeros);
        Assert.Contains(2, numeros);
    }

    // ---------- États ----------

    [Fact]
    public async Task A_new_table_is_free_with_nothing_to_collect()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, _, _) = await NewTableAsync(admin);

        var entry = await SalleEntryAsync(admin, id);

        Assert.Equal("Libre", Etat(entry));
        Assert.Equal(0m, entry.GetProperty("totalAEncaisser").GetDecimal());
        Assert.Equal(0, entry.GetProperty("nombreCommandes").GetInt32());
        Assert.Equal(JsonValueKind.Null, entry.GetProperty("premiereCommandeUtc").ValueKind);
        Assert.Empty(entry.GetProperty("commandes").EnumerateArray());
    }

    [Fact]
    public async Task A_dine_in_order_in_progress_makes_the_table_occupied_with_its_total_and_orders()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, orderId) = await OrderAtAsync(code, quantite: 2); // 2 × 3,50 = 7

        var entry = await SalleEntryAsync(admin, id);

        Assert.Equal("Occupee", Etat(entry));
        Assert.Equal(7m, entry.GetProperty("totalAEncaisser").GetDecimal());
        Assert.Equal(1, entry.GetProperty("nombreCommandes").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, entry.GetProperty("premiereCommandeUtc").ValueKind);
        var order = Assert.Single(entry.GetProperty("commandes").EnumerateArray());
        Assert.Equal(orderId, order.GetProperty("id").GetInt32());
        Assert.Equal("EnAttente", order.GetProperty("statut").GetString());
        Assert.Equal(7m, order.GetProperty("total").GetDecimal());
        Assert.False(order.GetProperty("estPayee").GetBoolean());
        Assert.StartsWith("CMD-", order.GetProperty("numero").GetString());
    }

    [Fact]
    public async Task A_finished_unpaid_order_means_payment_due_and_paying_frees_the_table()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, orderId) = await OrderAtAsync(code);
        await Advance(admin, orderId, "EnPreparation", "Prete", "Terminee");

        var due = await SalleEntryAsync(admin, id);
        Assert.Equal("AEncaisser", Etat(due));
        Assert.Equal(7m, due.GetProperty("totalAEncaisser").GetDecimal());

        await admin.PatchAsJsonAsync($"api/admin/commandes/{orderId}/paiement", new { estPayee = true });

        var freed = await SalleEntryAsync(admin, id);
        Assert.Equal("Libre", Etat(freed)); // terminée ET payée : sort de la salle
        Assert.Equal(0, freed.GetProperty("nombreCommandes").GetInt32());
    }

    [Fact]
    public async Task A_cancelled_order_does_not_count()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, orderId) = await OrderAtAsync(code);
        await Advance(admin, orderId, "Annulee");

        Assert.Equal("Libre", Etat(await SalleEntryAsync(admin, id)));
    }

    [Fact]
    public async Task An_inactive_table_is_reported_inactive_but_keeps_its_orders_visible()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        await OrderAtAsync(code);
        await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = false });

        var entry = await SalleEntryAsync(admin, id);

        Assert.Equal("Inactive", Etat(entry));
        Assert.False(entry.GetProperty("estActive").GetBoolean());
        Assert.Equal(1, entry.GetProperty("nombreCommandes").GetInt32());
    }

    [Fact]
    public async Task Orders_of_other_tables_and_takeaway_orders_are_not_mixed_in()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (idA, codeA, _) = await NewTableAsync(admin);
        var (idB, _, _) = await NewTableAsync(admin);
        await OrderAtAsync(codeA);
        var client = await factory.CreateClientForNewUserAsync();
        await client.PostAsJsonAsync("api/panier/items", new { articleId = await factory.ArticleIdAsync("Brik"), quantite = 1 });
        await client.PostAsJsonAsync("api/commandes", new { typeCommande = "ARemporter", telephone = "+21620123456" });

        Assert.Equal("Occupee", Etat(await SalleEntryAsync(admin, idA)));
        Assert.Equal("Libre", Etat(await SalleEntryAsync(admin, idB)));
    }

    [Fact]
    public async Task Several_orders_are_summed_and_the_oldest_gives_the_occupation_start()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, first) = await OrderAtAsync(code, quantite: 1);  // 3,50
        await OrderAtAsync(code, quantite: 2);                    // 7,00

        var entry = await SalleEntryAsync(admin, id);

        Assert.Equal(10.5m, entry.GetProperty("totalAEncaisser").GetDecimal());
        Assert.Equal(2, entry.GetProperty("nombreCommandes").GetInt32());
        var commandes = entry.GetProperty("commandes").EnumerateArray().ToList();
        Assert.Equal(first, commandes[0].GetProperty("id").GetInt32()); // plus ancienne d'abord
        Assert.Equal(commandes[0].GetProperty("dateCommande").GetDateTime(), entry.GetProperty("premiereCommandeUtc").GetDateTime());
    }

    // ---------- Encaisser ----------

    [Fact]
    public async Task Collecting_marks_every_unpaid_order_paid_without_touching_the_status_history()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, a) = await OrderAtAsync(code);
        var (_, b) = await OrderAtAsync(code);
        await Advance(admin, b, "EnPreparation");
        var historyBefore = (await Json(await admin.GetAsync($"api/admin/commandes/{b}"))).GetProperty("historique").GetArrayLength();

        var response = await admin.PostAsync($"api/admin/tables/{id}/encaisser", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var entry = await Json(response);
        Assert.Equal(0m, entry.GetProperty("totalAEncaisser").GetDecimal());
        Assert.All(entry.GetProperty("commandes").EnumerateArray(), c => Assert.True(c.GetProperty("estPayee").GetBoolean()));
        Assert.Equal("Occupee", Etat(entry)); // elles sont toujours en cours
        var detail = await Json(await admin.GetAsync($"api/admin/commandes/{b}"));
        Assert.True(detail.GetProperty("estPayee").GetBoolean());
        Assert.Equal(historyBefore, detail.GetProperty("historique").GetArrayLength());
        Assert.True((await Json(await admin.GetAsync($"api/admin/commandes/{a}"))).GetProperty("estPayee").GetBoolean());
    }

    [Fact]
    public async Task Collecting_ignores_cancelled_orders_and_other_tables()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (otherId, otherCode, _) = await NewTableAsync(admin);
        var (_, live) = await OrderAtAsync(code);
        var (_, cancelled) = await OrderAtAsync(code);
        var (_, elsewhere) = await OrderAtAsync(otherCode);
        await Advance(admin, cancelled, "Annulee");

        await admin.PostAsync($"api/admin/tables/{id}/encaisser", null);

        Assert.True((await Json(await admin.GetAsync($"api/admin/commandes/{live}"))).GetProperty("estPayee").GetBoolean());
        Assert.False((await Json(await admin.GetAsync($"api/admin/commandes/{cancelled}"))).GetProperty("estPayee").GetBoolean());
        Assert.False((await Json(await admin.GetAsync($"api/admin/commandes/{elsewhere}"))).GetProperty("estPayee").GetBoolean());
        Assert.Equal(7m, (await SalleEntryAsync(admin, otherId)).GetProperty("totalAEncaisser").GetDecimal());
    }

    [Fact]
    public async Task Collecting_again_or_on_an_empty_table_returns_409_and_changes_nothing()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);

        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsync($"api/admin/tables/{id}/encaisser", null)).StatusCode); // vide

        await OrderAtAsync(code);
        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"api/admin/tables/{id}/encaisser", null)).StatusCode);
        var again = await admin.PostAsync($"api/admin/tables/{id}/encaisser", null); // plus rien à encaisser
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Contains("rien à encaisser", (await Json(again)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Collecting_on_an_unknown_table_returns_404()
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync("api/admin/tables/999999/encaisser", null)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync("api/admin/tables/999999/liberer", null)).StatusCode);
    }

    // ---------- Libérer ----------

    [Fact]
    public async Task Freeing_after_collecting_finishes_ready_orders_with_history_and_author()
    {
        var admin = await factory.CreateClientAsync("admin");
        var adminId = await factory.GetUserIdAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (client, orderId) = await OrderAtAsync(code);
        await Advance(admin, orderId, "EnPreparation", "Prete");

        // Prête mais non payée : impossible de libérer.
        var refused = await admin.PostAsync($"api/admin/tables/{id}/liberer", null);
        Assert.Equal(HttpStatusCode.Conflict, refused.StatusCode);
        Assert.Contains("encaissez", (await Json(refused)).GetProperty("title").GetString(), StringComparison.OrdinalIgnoreCase);
        Assert.Equal("Prete", (await Json(await admin.GetAsync($"api/admin/commandes/{orderId}"))).GetProperty("statut").GetString());

        await admin.PostAsync($"api/admin/tables/{id}/encaisser", null);
        var freed = await admin.PostAsync($"api/admin/tables/{id}/liberer", null);

        Assert.Equal(HttpStatusCode.OK, freed.StatusCode);
        Assert.Equal("Libre", Etat(await Json(freed)));
        var detail = await Json(await admin.GetAsync($"api/admin/commandes/{orderId}"));
        Assert.Equal("Terminee", detail.GetProperty("statut").GetString());
        var history = detail.GetProperty("historique").EnumerateArray().ToList();
        Assert.Equal(["EnAttente", "EnPreparation", "Prete", "Terminee"], history.Select(h => h.GetProperty("statut").GetString()!).ToArray());
        Assert.Equal(adminId, history[^1].GetProperty("parUserId").GetString());
        Assert.Equal("admin", history[^1].GetProperty("parNom").GetString());
        // Le client voit la commande terminée.
        Assert.Equal("Terminee", (await Json(await client.GetAsync($"api/commandes/{orderId}"))).GetProperty("statut").GetString());
    }

    [Theory]
    [InlineData("EnAttente")]
    [InlineData("EnPreparation")]
    public async Task Freeing_is_refused_while_an_order_is_waiting_or_being_prepared(string statut)
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, orderId) = await OrderAtAsync(code);
        if (statut == "EnPreparation")
        {
            await Advance(admin, orderId, "EnPreparation");
        }

        await admin.PostAsync($"api/admin/tables/{id}/encaisser", null); // même payée, la commande est en cours
        var response = await admin.PostAsync($"api/admin/tables/{id}/liberer", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var message = (await Json(response)).GetProperty("title").GetString()!;
        Assert.Contains("en attente ou en préparation", message);
        Assert.Contains("terminez-les ou annulez-les", message);
        Assert.Equal(statut, (await Json(await admin.GetAsync($"api/admin/commandes/{orderId}"))).GetProperty("statut").GetString());
    }

    [Fact]
    public async Task Freeing_is_refused_when_a_finished_order_is_unpaid()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, orderId) = await OrderAtAsync(code);
        await Advance(admin, orderId, "EnPreparation", "Prete", "Terminee");

        var response = await admin.PostAsync($"api/admin/tables/{id}/liberer", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("non encaissée", (await Json(response)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task The_refusal_names_every_blocking_reason_and_nothing_is_modified()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);
        var (_, ready) = await OrderAtAsync(code);
        var (_, cooking) = await OrderAtAsync(code);
        await Advance(admin, ready, "EnPreparation", "Prete");
        await Advance(admin, cooking, "EnPreparation");

        var response = await admin.PostAsync($"api/admin/tables/{id}/liberer", null);

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var message = (await Json(response)).GetProperty("title").GetString()!;
        Assert.Contains("en attente ou en préparation", message);
        Assert.Contains("non encaissée", message);
        // Aucune commande « Prete » n'a été terminée par erreur.
        Assert.Equal("Prete", (await Json(await admin.GetAsync($"api/admin/commandes/{ready}"))).GetProperty("statut").GetString());
    }

    [Fact]
    public async Task Freeing_a_free_table_is_idempotent_and_cancelled_orders_never_block()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (id, code, _) = await NewTableAsync(admin);

        Assert.Equal(HttpStatusCode.OK, (await admin.PostAsync($"api/admin/tables/{id}/liberer", null)).StatusCode);

        var (_, orderId) = await OrderAtAsync(code);
        await Advance(admin, orderId, "Annulee");
        var response = await admin.PostAsync($"api/admin/tables/{id}/liberer", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal("Annulee", (await Json(await admin.GetAsync($"api/admin/commandes/{orderId}"))).GetProperty("statut").GetString());
    }

    [Fact]
    public async Task Freeing_one_table_leaves_the_others_untouched()
    {
        var admin = await factory.CreateClientAsync("admin");
        var (idA, codeA, _) = await NewTableAsync(admin);
        var (idB, codeB, _) = await NewTableAsync(admin);
        var (_, a) = await OrderAtAsync(codeA);
        var (_, b) = await OrderAtAsync(codeB);
        await Advance(admin, a, "EnPreparation", "Prete");
        await Advance(admin, b, "EnPreparation", "Prete");
        await admin.PostAsync($"api/admin/tables/{idA}/encaisser", null);

        await admin.PostAsync($"api/admin/tables/{idA}/liberer", null);

        Assert.Equal("Terminee", (await Json(await admin.GetAsync($"api/admin/commandes/{a}"))).GetProperty("statut").GetString());
        Assert.Equal("Prete", (await Json(await admin.GetAsync($"api/admin/commandes/{b}"))).GetProperty("statut").GetString());
        Assert.Equal("Occupee", Etat(await SalleEntryAsync(admin, idB)));
    }

    // ---------- Régénération, doublons, public ----------

    [Fact]
    public async Task Regenerating_the_code_returns_404_for_the_old_one_and_a_duplicate_number_returns_409()
    {
        var admin = await factory.CreateClientAsync("admin");
        var anonymous = await factory.CreateClientAsync();
        var (id, oldCode, numero) = await NewTableAsync(admin);

        var regenerated = await Json(await admin.PostAsync($"api/admin/tables/{id}/regenerer-code", null));

        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"api/tables/{oldCode}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"api/tables/{regenerated.GetProperty("code").GetGuid()}")).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await admin.PostAsJsonAsync("api/admin/tables", new { numero, capacite = 2 })).StatusCode);
    }

    [Fact]
    public async Task The_public_lookup_only_serves_active_tables_and_ignores_the_floor_state()
    {
        var admin = await factory.CreateClientAsync("admin");
        var anonymous = await factory.CreateClientAsync();
        var (id, code, _) = await NewTableAsync(admin);
        await OrderAtAsync(code);

        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"api/tables/{code}")).StatusCode); // occupée mais active
        await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = false });
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"api/tables/{code}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"api/tables/{ApiFactory.InactiveTableCode}")).StatusCode);
    }
}
