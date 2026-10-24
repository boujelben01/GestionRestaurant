using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Resto.Api.Data;

namespace Resto.Tests;

// EF InMemory : pas d'index unique PostgreSQL (le 409 « numéro dupliqué » ne vient donc que du contrôle
// applicatif, pas de la contrainte SQL), pas de CHECK ni de vraies transactions.
public class AdminTablesApiTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private static int _next = 100; // numéros uniques entre tests (la base est partagée par la classe)

    public Task InitializeAsync() => factory.ResetRestaurantAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static int NextNumero() => Interlocked.Increment(ref _next);

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static async Task<JsonElement> CreateAsync(HttpClient admin, int? numero = null, int capacite = 4)
    {
        var response = await admin.PostAsJsonAsync("api/admin/tables", new { numero, capacite });
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await Json(response);
    }

    public static TheoryData<string, string> Routes => new()
    {
        { "GET", "api/admin/tables" },
        { "GET", "api/admin/tables/1" },
        { "POST", "api/admin/tables" },
        { "PUT", "api/admin/tables/1" },
        { "PATCH", "api/admin/tables/1/active" },
        { "POST", "api/admin/tables/1/regenerer-code" }
    };

    private static HttpRequestMessage Request(string method, string url) =>
        new(new HttpMethod(method), url) { Content = method == "GET" ? null : JsonContent.Create(new { numero = 1, capacite = 2, estActive = false }) };

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Table_admin_routes_return_401_without_token(string method, string url)
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(Request(method, url))).StatusCode);
    }

    [Theory]
    [MemberData(nameof(Routes))]
    public async Task Table_admin_routes_return_403_for_a_client(string method, string url)
    {
        var client = await factory.CreateClientAsync("client");

        Assert.Equal(HttpStatusCode.Forbidden, (await client.SendAsync(Request(method, url))).StatusCode);
    }

    // ---------- Liste ----------

    [Fact]
    public async Task The_list_returns_every_table_inactive_ones_included_sorted_by_number()
    {
        var admin = await factory.CreateClientAsync("admin");
        var high = await CreateAsync(admin, 5000 + NextNumero()); // plage distincte : pas de collision avec NextNumero()
        var low = await CreateAsync(admin, NextNumero());

        var list = await Json(await admin.GetAsync("api/admin/tables"));

        var numeros = list.EnumerateArray().Select(t => t.GetProperty("numero").GetInt32()).ToList();
        Assert.Equal(numeros.OrderBy(n => n).ToList(), numeros);
        Assert.True(numeros.IndexOf(low.GetProperty("numero").GetInt32()) < numeros.IndexOf(high.GetProperty("numero").GetInt32()));
        // La table inactive du jeu de test (n° 2) est bien listée.
        var inactive = list.EnumerateArray().Single(t => t.GetProperty("code").GetGuid() == ApiFactory.InactiveTableCode);
        Assert.False(inactive.GetProperty("estActive").GetBoolean());
        foreach (var field in new[] { "id", "numero", "code", "capacite", "estActive" })
        {
            Assert.True(inactive.TryGetProperty(field, out _), field);
        }
    }

    // ---------- Création ----------

    [Fact]
    public async Task Creation_with_an_explicit_number_returns_201_with_a_fresh_code()
    {
        var admin = await factory.CreateClientAsync("admin");
        var numero = NextNumero();

        var response = await admin.PostAsJsonAsync("api/admin/tables", new { numero, capacite = 6 });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Contains("api/admin/tables/", response.Headers.Location!.ToString());
        var table = await Json(response);
        Assert.Equal(numero, table.GetProperty("numero").GetInt32());
        Assert.Equal(6, table.GetProperty("capacite").GetInt32());
        Assert.True(table.GetProperty("estActive").GetBoolean());
        Assert.NotEqual(Guid.Empty, table.GetProperty("code").GetGuid());
    }

    [Fact]
    public async Task Without_a_number_the_next_free_one_is_used_and_codes_are_unique()
    {
        var admin = await factory.CreateClientAsync("admin");
        // Les numéros automatiques sont « max + 1 » : on place d'abord un numéro très haut pour qu'ils ne
        // recoupent jamais les numéros que NextNumero() attribue aux autres tests de la classe.
        await CreateAsync(admin, 8000 + NextNumero());
        var max = (await Json(await admin.GetAsync("api/admin/tables"))).EnumerateArray().Max(t => t.GetProperty("numero").GetInt32());

        var first = await CreateAsync(admin);
        var second = await CreateAsync(admin);

        Assert.Equal(max + 1, first.GetProperty("numero").GetInt32());
        Assert.Equal(max + 2, second.GetProperty("numero").GetInt32());
        Assert.NotEqual(first.GetProperty("code").GetGuid(), second.GetProperty("code").GetGuid());
    }

    [Fact]
    public async Task A_duplicate_number_returns_409_and_creates_nothing()
    {
        var admin = await factory.CreateClientAsync("admin");
        var numero = NextNumero();
        await CreateAsync(admin, numero);
        var before = (await Json(await admin.GetAsync("api/admin/tables"))).GetArrayLength();

        var response = await admin.PostAsJsonAsync("api/admin/tables", new { numero, capacite = 2 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains($"n° {numero}", (await Json(response)).GetProperty("title").GetString());
        Assert.Equal(before, (await Json(await admin.GetAsync("api/admin/tables"))).GetArrayLength());
    }

    [Theory]
    [InlineData("{\"capacite\":0}")]
    [InlineData("{\"capacite\":51}")]
    [InlineData("{\"capacite\":-3}")]
    [InlineData("{}")]
    [InlineData("{\"numero\":0,\"capacite\":4}")]
    [InlineData("{\"numero\":10000,\"capacite\":4}")]
    [InlineData("{\"numero\":\"abc\",\"capacite\":4}")]
    [InlineData("{\"capacite\":\"beaucoup\"}")]
    public async Task Invalid_input_returns_400_never_500(string body)
    {
        var admin = await factory.CreateClientAsync("admin");

        var response = await admin.PostAsync("api/admin/tables", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Theory]
    [InlineData(1)]
    [InlineData(50)]
    public async Task Capacity_bounds_are_inclusive(int capacite)
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("api/admin/tables", new { numero = NextNumero(), capacite })).StatusCode);
    }

    // ---------- Modification ----------

    [Fact]
    public async Task A_table_can_be_updated_and_keeps_its_code_and_state()
    {
        var admin = await factory.CreateClientAsync("admin");
        var table = await CreateAsync(admin, NextNumero());
        var id = table.GetProperty("id").GetInt32();
        var newNumero = NextNumero();

        var response = await admin.PutAsJsonAsync($"api/admin/tables/{id}", new { numero = newNumero, capacite = 8 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await Json(response);
        Assert.Equal(newNumero, updated.GetProperty("numero").GetInt32());
        Assert.Equal(8, updated.GetProperty("capacite").GetInt32());
        Assert.Equal(table.GetProperty("code").GetGuid(), updated.GetProperty("code").GetGuid());
        Assert.True(updated.GetProperty("estActive").GetBoolean());
    }

    [Fact]
    public async Task Keeping_the_same_number_on_update_is_not_a_conflict()
    {
        var admin = await factory.CreateClientAsync("admin");
        var table = await CreateAsync(admin, NextNumero());

        var response = await admin.PutAsJsonAsync($"api/admin/tables/{table.GetProperty("id").GetInt32()}",
            new { numero = table.GetProperty("numero").GetInt32(), capacite = 3 });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Updating_to_another_tables_number_returns_409_and_changes_nothing()
    {
        var admin = await factory.CreateClientAsync("admin");
        var a = await CreateAsync(admin, NextNumero());
        var b = await CreateAsync(admin, NextNumero());

        var response = await admin.PutAsJsonAsync($"api/admin/tables/{b.GetProperty("id").GetInt32()}",
            new { numero = a.GetProperty("numero").GetInt32(), capacite = 9 });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var after = await Json(await admin.GetAsync($"api/admin/tables/{b.GetProperty("id").GetInt32()}"));
        Assert.Equal(b.GetProperty("numero").GetInt32(), after.GetProperty("numero").GetInt32());
        Assert.Equal(b.GetProperty("capacite").GetInt32(), after.GetProperty("capacite").GetInt32());
    }

    [Fact]
    public async Task Unknown_tables_return_404_and_invalid_updates_return_400()
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.NotFound, (await admin.GetAsync("api/admin/tables/999999")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PutAsJsonAsync("api/admin/tables/999999", new { numero = 5, capacite = 2 })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PatchAsJsonAsync("api/admin/tables/999999/active", new { estActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await admin.PostAsync("api/admin/tables/999999/regenerer-code", null)).StatusCode);

        var table = await CreateAsync(admin, NextNumero());
        var id = table.GetProperty("id").GetInt32();
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"api/admin/tables/{id}", new { numero = 0, capacite = 2 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await admin.PutAsJsonAsync($"api/admin/tables/{id}", new { numero = 5, capacite = 99 })).StatusCode);
    }

    // ---------- Activation ----------

    [Fact]
    public async Task Deactivating_a_table_makes_its_public_lookup_return_404_and_reactivating_restores_it()
    {
        var admin = await factory.CreateClientAsync("admin");
        var anonymous = await factory.CreateClientAsync();
        var table = await CreateAsync(admin, NextNumero());
        var id = table.GetProperty("id").GetInt32();
        var code = table.GetProperty("code").GetGuid();
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"api/tables/{code}")).StatusCode);

        var off = await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = false });
        Assert.False((await Json(off)).GetProperty("estActive").GetBoolean());
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"api/tables/{code}")).StatusCode);

        await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = true });
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"api/tables/{code}")).StatusCode);
    }

    [Fact]
    public async Task Setting_the_same_state_again_is_idempotent()
    {
        var admin = await factory.CreateClientAsync("admin");
        var id = (await CreateAsync(admin, NextNumero())).GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = true })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = false })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = false })).StatusCode);
    }

    [Fact]
    public async Task A_deactivated_table_refuses_new_dine_in_orders()
    {
        var admin = await factory.CreateClientAsync("admin");
        var table = await CreateAsync(admin, NextNumero());
        await admin.PatchAsJsonAsync($"api/admin/tables/{table.GetProperty("id").GetInt32()}/active", new { estActive = false });
        var (client, _) = await ClientWithCartAsync();

        var response = await client.PostAsJsonAsync("api/commandes",
            new { typeCommande = "SurPlace", telephone = "+21620123456", tableCode = table.GetProperty("code").GetGuid() });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    // ---------- Régénération du code ----------

    [Fact]
    public async Task Regenerating_the_code_invalidates_the_old_qr_and_the_new_one_works()
    {
        var admin = await factory.CreateClientAsync("admin");
        var anonymous = await factory.CreateClientAsync();
        var table = await CreateAsync(admin, NextNumero());
        var id = table.GetProperty("id").GetInt32();
        var oldCode = table.GetProperty("code").GetGuid();

        var response = await admin.PostAsync($"api/admin/tables/{id}/regenerer-code", null);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var regenerated = await Json(response);
        var newCode = regenerated.GetProperty("code").GetGuid();
        Assert.NotEqual(oldCode, newCode);
        Assert.NotEqual(Guid.Empty, newCode);
        Assert.Equal(table.GetProperty("numero").GetInt32(), regenerated.GetProperty("numero").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"api/tables/{oldCode}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"api/tables/{newCode}")).StatusCode);
        Assert.Equal(newCode, (await Json(await admin.GetAsync($"api/admin/tables/{id}"))).GetProperty("code").GetGuid());
    }

    [Fact]
    public async Task Regenerating_twice_gives_two_different_codes()
    {
        var admin = await factory.CreateClientAsync("admin");
        var id = (await CreateAsync(admin, NextNumero())).GetProperty("id").GetInt32();

        var first = (await Json(await admin.PostAsync($"api/admin/tables/{id}/regenerer-code", null))).GetProperty("code").GetGuid();
        var second = (await Json(await admin.PostAsync($"api/admin/tables/{id}/regenerer-code", null))).GetProperty("code").GetGuid();

        Assert.NotEqual(first, second);
    }

    // ---------- Commandes passées ----------

    private async Task<(HttpClient Client, int Brik)> ClientWithCartAsync()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var brik = await factory.ArticleIdAsync("Brik");
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync("api/panier/items", new { articleId = brik, quantite = 1 })).StatusCode);
        return (client, brik);
    }

    [Fact]
    public async Task Deactivating_or_regenerating_leaves_past_orders_untouched()
    {
        var admin = await factory.CreateClientAsync("admin");
        var table = await CreateAsync(admin, NextNumero());
        var id = table.GetProperty("id").GetInt32();
        var numero = table.GetProperty("numero").GetInt32();
        var (client, _) = await ClientWithCartAsync();
        var order = await Json(await client.PostAsJsonAsync("api/commandes",
            new { typeCommande = "SurPlace", telephone = "+21620123456", tableCode = table.GetProperty("code").GetGuid() }));
        var orderId = order.GetProperty("id").GetInt32();
        Assert.Equal(numero, order.GetProperty("tableNumero").GetInt32());

        await admin.PatchAsJsonAsync($"api/admin/tables/{id}/active", new { estActive = false });
        await admin.PostAsync($"api/admin/tables/{id}/regenerer-code", null);

        var clientView = await Json(await client.GetAsync($"api/commandes/{orderId}"));
        Assert.Equal(numero, clientView.GetProperty("tableNumero").GetInt32());
        var adminView = await Json(await admin.GetAsync($"api/admin/commandes/{orderId}"));
        Assert.Equal(numero, adminView.GetProperty("tableNumero").GetInt32());
        Assert.Equal("EnAttente", adminView.GetProperty("statut").GetString());
        using var scope = factory.Services.CreateScope();
        Assert.True(await scope.ServiceProvider.GetRequiredService<AppDbContext>().Commandes.AnyAsync(c => c.Id == orderId && c.TableId == id));
    }

    [Fact]
    public async Task Renumbering_a_table_changes_the_number_shown_on_its_past_orders_a_documented_side_effect()
    {
        // Le numéro affiché sur une commande est lu sur la table (jointure), pas copié sur la commande.
        var admin = await factory.CreateClientAsync("admin");
        var table = await CreateAsync(admin, NextNumero());
        var id = table.GetProperty("id").GetInt32();
        var (client, _) = await ClientWithCartAsync();
        var orderId = (await Json(await client.PostAsJsonAsync("api/commandes",
            new { typeCommande = "SurPlace", telephone = "+21620123456", tableCode = table.GetProperty("code").GetGuid() }))).GetProperty("id").GetInt32();
        var renumbered = NextNumero();

        await admin.PutAsJsonAsync($"api/admin/tables/{id}", new { numero = renumbered, capacite = 4 });

        Assert.Equal(renumbered, (await Json(await client.GetAsync($"api/commandes/{orderId}"))).GetProperty("tableNumero").GetInt32());
    }

    // ---------- Pas de suppression ----------

    [Fact]
    public async Task There_is_no_delete_route()
    {
        var admin = await factory.CreateClientAsync("admin");
        var id = (await CreateAsync(admin, NextNumero())).GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await admin.DeleteAsync($"api/admin/tables/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync($"api/admin/tables/{id}")).StatusCode);
    }

    // ---------- Route publique ----------

    [Fact]
    public async Task The_public_lookup_is_anonymous_and_only_serves_active_tables()
    {
        var anonymous = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"api/tables/{ApiFactory.TableCode}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"api/tables/{ApiFactory.InactiveTableCode}")).StatusCode);
    }
}

// Le numéro 9999 bloque la numérotation automatique pour toute la base : test isolé dans sa propre classe.
public class AdminTablesMaxNumberTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task The_automatic_number_cannot_exceed_the_maximum()
    {
        var admin = await factory.CreateClientAsync("admin");
        Assert.Equal(HttpStatusCode.Created, (await admin.PostAsJsonAsync("api/admin/tables", new { numero = 9999, capacite = 2 })).StatusCode);

        var response = await admin.PostAsJsonAsync("api/admin/tables", new { capacite = 2 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
