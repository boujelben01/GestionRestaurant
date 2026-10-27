using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.RegularExpressions;
using Resto.Api.Domain;

namespace Resto.Tests;

// EF InMemory : pas de vrais verrous (FOR UPDATE), pas de transaction réelle, pas de CHECK ni d'index uniques
// PostgreSQL. Le mécanisme anti-doublon (verrou du panier) n'est donc PAS exercé ici : seul le double clic
// séquentiel est testé.
public class CommandeApiTests(ApiFactory factory) : IClassFixture<ApiFactory>, IAsyncLifetime
{
    private const string Phone = "+21620123456";

    public Task InitializeAsync() => factory.ResetRestaurantAsync();

    public Task DisposeAsync() => Task.CompletedTask;

    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static async Task<HttpResponseMessage> AddAsync(HttpClient client, int articleId, int quantite) =>
        await client.PostAsJsonAsync("api/panier/items", new { articleId, quantite });

    private static Task<HttpResponseMessage> Commander(HttpClient client, object body) =>
        client.PostAsJsonAsync("api/commandes", body);

    private static object Takeaway(string telephone = Phone) => new { typeCommande = "ARemporter", telephone };

    private async Task<(HttpClient Client, int Brik)> ClientWithBrikAsync(int quantite)
    {
        var client = await factory.CreateClientForNewUserAsync();
        var brik = await factory.ArticleIdAsync("Brik");
        Assert.Equal(HttpStatusCode.OK, (await AddAsync(client, brik, quantite)).StatusCode);
        return (client, brik);
    }

    [Theory]
    [InlineData("api/panier")]
    [InlineData("api/commandes")]
    public async Task Cart_and_orders_require_authentication(string url)
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await client.PostAsJsonAsync("api/commandes", Takeaway())).StatusCode);
    }

    [Fact]
    public async Task Cart_accumulates_quantities_with_a_cap_of_twenty_and_uses_current_prices()
    {
        var (client, brik) = await ClientWithBrikAsync(2);

        await AddAsync(client, brik, 3);
        var cart = await Json(await client.GetAsync("api/panier"));
        var ligne = Assert.Single(cart.GetProperty("lignes").EnumerateArray());
        Assert.Equal(5, ligne.GetProperty("quantite").GetInt32());
        Assert.Equal("Brik", ligne.GetProperty("nom").GetString());
        Assert.Equal(17.5m, cart.GetProperty("sousTotal").GetDecimal());
        Assert.True(ligne.GetProperty("disponible").GetBoolean());

        var capped = await Json(await AddAsync(client, brik, 20));
        Assert.Equal(20, capped.GetProperty("lignes")[0].GetProperty("quantite").GetInt32());
    }

    [Fact]
    public async Task Cart_quantity_can_be_set_and_lines_removed_idempotently()
    {
        var (client, brik) = await ClientWithBrikAsync(2);

        var set = await Json(await client.PutAsJsonAsync($"api/panier/items/{brik}", new { quantite = 7 }));
        Assert.Equal(7, set.GetProperty("lignes")[0].GetProperty("quantite").GetInt32());

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"api/panier/items/{brik}", new { quantite = 21 })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync($"api/panier/items/{brik}", new { quantite = 0 })).StatusCode);

        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync($"api/panier/items/{brik}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync($"api/panier/items/{brik}")).StatusCode);
        Assert.Equal(0, (await Json(await client.GetAsync("api/panier"))).GetProperty("lignes").GetArrayLength());

        await AddAsync(client, brik, 1);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("api/panier")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.DeleteAsync("api/panier")).StatusCode);
        Assert.Equal(0, (await Json(await client.GetAsync("api/panier"))).GetProperty("lignes").GetArrayLength());
    }

    [Fact]
    public async Task Cart_refuses_unknown_inactive_and_unavailable_articles()
    {
        var client = await factory.CreateClientForNewUserAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await AddAsync(client, 999999, 1)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AddAsync(client, await factory.ArticleIdAsync("Ancien plat"), 1)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await AddAsync(client, await factory.ArticleIdAsync("Caché"), 1)).StatusCode);
        Assert.Equal(HttpStatusCode.Conflict, (await AddAsync(client, await factory.ArticleIdAsync("Soupe"), 1)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await AddAsync(client, 1, 0)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await AddAsync(client, 1, 21)).StatusCode);
    }

    [Fact]
    public async Task Cart_flags_lines_whose_article_became_unavailable()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var id = await factory.CreateArticleAsync("Temp-warning");
        await AddAsync(client, id, 1);
        await factory.SetArticleAsync(id, disponible: false);

        var ligne = (await Json(await client.GetAsync("api/panier"))).GetProperty("lignes")[0];

        Assert.False(ligne.GetProperty("disponible").GetBoolean());
        Assert.Equal("indisponible", ligne.GetProperty("avertissement").GetString());
    }

    [Fact]
    public async Task Takeaway_order_is_computed_server_side_and_empties_the_cart()
    {
        var (client, _) = await ClientWithBrikAsync(2);

        var response = await Commander(client, new
        {
            typeCommande = "ARemporter", telephone = Phone, note = "Sans harissa",
            userId = "autre-utilisateur", panierId = 1, sousTotal = 0.01m, fraisLivraison = -5m, total = 0.01m
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var commande = await Json(response);
        Assert.Matches(new Regex(@"^CMD-\d{6}$"), commande.GetProperty("numero").GetString());
        Assert.Equal("EnAttente", commande.GetProperty("statut").GetString());
        Assert.Equal("Especes", commande.GetProperty("modePaiement").GetString());
        Assert.Equal(7m, commande.GetProperty("sousTotal").GetDecimal());
        Assert.Equal(0m, commande.GetProperty("fraisLivraison").GetDecimal());
        Assert.Equal(7m, commande.GetProperty("total").GetDecimal());
        Assert.Equal(1, commande.GetProperty("historique").GetArrayLength());
        var ligne = commande.GetProperty("lignes")[0];
        Assert.Equal("Brik", ligne.GetProperty("nomFr").GetString());
        Assert.Equal(3.5m, ligne.GetProperty("prixUnitaire").GetDecimal());
        Assert.EndsWith("Z", commande.GetProperty("dateCommande").GetString());

        Assert.Equal(0, (await Json(await client.GetAsync("api/panier"))).GetProperty("lignes").GetArrayLength());

        var again = await Commander(client, Takeaway());
        Assert.Equal(HttpStatusCode.BadRequest, again.StatusCode);
        Assert.Contains("panier est vide", await again.Content.ReadAsStringAsync());
    }

    [Fact]
    public async Task Order_belongs_to_the_token_user_never_to_an_id_in_the_body()
    {
        var (owner, brik) = await ClientWithBrikAsync(1);
        var other = await factory.CreateClientForNewUserAsync();
        var otherId = (await Json(await other.GetAsync("api/auth/me"))).GetProperty("id").GetString();
        await AddAsync(other, brik, 1);

        var created = await Json(await Commander(owner, new { typeCommande = "ARemporter", telephone = Phone, userId = otherId }));
        var id = created.GetProperty("id").GetInt32();

        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"api/commandes/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await other.GetAsync($"api/commandes/{id}")).StatusCode);
        Assert.Equal(0, (await Json(await other.GetAsync("api/commandes"))).GetProperty("total").GetInt32());
        Assert.Equal(1, (await Json(await other.GetAsync("api/panier"))).GetProperty("lignes").GetArrayLength());
    }

    [Fact]
    public async Task Other_users_cannot_cancel_an_order()
    {
        var (owner, _) = await ClientWithBrikAsync(1);
        var id = (await Json(await Commander(owner, Takeaway()))).GetProperty("id").GetInt32();
        var other = await factory.CreateClientForNewUserAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await other.PostAsync($"api/commandes/{id}/annuler", null)).StatusCode);
        Assert.Equal("EnAttente", (await Json(await owner.GetAsync($"api/commandes/{id}"))).GetProperty("statut").GetString());
    }

    [Fact]
    public async Task Empty_cart_is_refused()
    {
        var client = await factory.CreateClientForNewUserAsync();

        var response = await Commander(client, Takeaway());

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Unavailable_article_in_the_cart_blocks_the_order_and_keeps_the_cart()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var id = await factory.CreateArticleAsync("Temp-bloque");
        await AddAsync(client, id, 1);
        await factory.SetArticleAsync(id, disponible: false);

        var response = await Commander(client, Takeaway());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("Temp-bloque", await response.Content.ReadAsStringAsync());
        Assert.Equal(1, (await Json(await client.GetAsync("api/panier"))).GetProperty("lignes").GetArrayLength());
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task Closed_restaurant_refuses_orders(bool open, bool commandesOuvertes)
    {
        var (client, _) = await ClientWithBrikAsync(1);
        await factory.SetRestaurantAsync(open, commandesOuvertes);

        var response = await Commander(client, Takeaway());

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Equal(1, (await Json(await client.GetAsync("api/panier"))).GetProperty("lignes").GetArrayLength());
    }

    [Fact]
    public async Task Delivery_needs_minimum_amount_and_address_and_adds_the_fee()
    {
        var (client, brik) = await ClientWithBrikAsync(2);
        const string address = "12 rue de la Liberté, Tunis";

        var tooLow = await Commander(client, new { typeCommande = "Livraison", telephone = Phone, adresseLivraison = address });
        Assert.Equal(HttpStatusCode.BadRequest, tooLow.StatusCode);

        await AddAsync(client, brik, 3);
        var noAddress = await Commander(client, new { typeCommande = "Livraison", telephone = Phone });
        Assert.Equal(HttpStatusCode.BadRequest, noAddress.StatusCode);
        var shortAddress = await Commander(client, new { typeCommande = "Livraison", telephone = Phone, adresseLivraison = "court" });
        Assert.Equal(HttpStatusCode.BadRequest, shortAddress.StatusCode);

        var ok = await Commander(client, new { typeCommande = "Livraison", telephone = Phone, adresseLivraison = address });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        var commande = await Json(ok);
        Assert.Equal(17.5m, commande.GetProperty("sousTotal").GetDecimal());
        Assert.Equal(3m, commande.GetProperty("fraisLivraison").GetDecimal());
        Assert.Equal(20.5m, commande.GetProperty("total").GetDecimal());
        Assert.Equal(address, commande.GetProperty("adresseLivraison").GetString());
    }

    [Fact]
    public async Task Dine_in_requires_an_active_table_code()
    {
        var (client, _) = await ClientWithBrikAsync(1);

        Assert.Equal(HttpStatusCode.BadRequest, (await Commander(client, new { typeCommande = "SurPlace", telephone = Phone })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Commander(client, new { typeCommande = "SurPlace", telephone = Phone, tableCode = Guid.NewGuid() })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest,
            (await Commander(client, new { typeCommande = "SurPlace", telephone = Phone, tableCode = ApiFactory.InactiveTableCode })).StatusCode);

        var ok = await Commander(client, new { typeCommande = "SurPlace", telephone = Phone, tableCode = ApiFactory.TableCode });
        Assert.Equal(HttpStatusCode.Created, ok.StatusCode);
        Assert.Equal(1, (await Json(ok)).GetProperty("tableNumero").GetInt32());
    }

    [Fact]
    public async Task Invalid_order_type_or_phone_is_a_validation_error()
    {
        var (client, _) = await ClientWithBrikAsync(1);

        Assert.Equal(HttpStatusCode.BadRequest, (await Commander(client, new { typeCommande = "Inconnu", telephone = Phone })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Commander(client, new { typeCommande = 1, telephone = Phone })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Commander(client, new { telephone = Phone })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await Commander(client, new { typeCommande = "ARemporter" })).StatusCode);
    }

    [Fact]
    public async Task Pending_order_can_be_cancelled_once_and_other_statuses_cannot()
    {
        var (client, brik) = await ClientWithBrikAsync(1);
        var id = (await Json(await Commander(client, Takeaway()))).GetProperty("id").GetInt32();

        var cancelled = await client.PostAsync($"api/commandes/{id}/annuler", null);
        Assert.Equal(HttpStatusCode.OK, cancelled.StatusCode);
        var body = await Json(cancelled);
        Assert.Equal("Annulee", body.GetProperty("statut").GetString());
        Assert.Equal(2, body.GetProperty("historique").GetArrayLength());
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"api/commandes/{id}/annuler", null)).StatusCode);

        await AddAsync(client, brik, 1);
        var second = (await Json(await Commander(client, Takeaway()))).GetProperty("id").GetInt32();
        await factory.SetCommandeStatutAsync(second, StatutCommande.EnPreparation);
        Assert.Equal(HttpStatusCode.Conflict, (await client.PostAsync($"api/commandes/{second}/annuler", null)).StatusCode);
    }

    [Fact]
    public async Task Order_list_is_paginated_newest_first_and_bounded()
    {
        var (client, brik) = await ClientWithBrikAsync(1);
        var first = (await Json(await Commander(client, Takeaway()))).GetProperty("id").GetInt32();
        await AddAsync(client, brik, 2);
        var second = (await Json(await Commander(client, Takeaway()))).GetProperty("id").GetInt32();

        var list = await Json(await client.GetAsync("api/commandes?pageSize=500"));

        Assert.Equal(50, list.GetProperty("pageSize").GetInt32());
        Assert.Equal(2, list.GetProperty("total").GetInt32());
        Assert.Equal([second, first], list.GetProperty("items").EnumerateArray().Select(c => c.GetProperty("id").GetInt32()));
        Assert.Equal(2, list.GetProperty("items")[0].GetProperty("nombreArticles").GetInt32());
    }

    [Fact]
    public async Task Table_lookup_is_anonymous_and_only_returns_active_tables()
    {
        var client = await factory.CreateClientAsync();

        var ok = await client.GetAsync($"api/tables/{ApiFactory.TableCode}");
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal(1, (await Json(ok)).GetProperty("numero").GetInt32());
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"api/tables/{ApiFactory.InactiveTableCode}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"api/tables/{Guid.NewGuid()}")).StatusCode);
    }
}
