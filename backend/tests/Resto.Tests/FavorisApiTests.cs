using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Resto.Tests;

// EF InMemory : pas de clé primaire composite appliquée par la base ni de vraie contrainte d'unicité PostgreSQL
// (la course « deux ajouts simultanés » n'est donc pas exercée) ; la traduction SQL est vérifiée dans SqlTranslationTests.
public class FavorisApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static Task<HttpResponseMessage> Put(HttpClient client, int articleId) =>
        client.PutAsync($"api/favoris/{articleId}", null);

    private static async Task<int[]> Ids(HttpClient client) =>
        (await Json(await client.GetAsync("api/favoris/ids"))).EnumerateArray().Select(e => e.GetInt32()).ToArray();

    // ---------- Accès ----------

    [Theory]
    [InlineData("GET", "api/favoris")]
    [InlineData("GET", "api/favoris/ids")]
    [InlineData("PUT", "api/favoris/1")]
    [InlineData("DELETE", "api/favoris/1")]
    public async Task Favourites_require_authentication(string method, string url)
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(new HttpRequestMessage(new HttpMethod(method), url))).StatusCode);
    }

    // ---------- Ajout / retrait ----------

    [Fact]
    public async Task Adding_a_favourite_returns_204_and_is_idempotent()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var brik = await factory.ArticleIdAsync("Brik");

        Assert.Equal(HttpStatusCode.NoContent, (await Put(client, brik)).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await Put(client, brik)).StatusCode); // deuxième fois : aucun doublon

        Assert.Equal([brik], await Ids(client));
    }

    [Fact]
    public async Task Removing_a_favourite_returns_204_and_is_idempotent()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var brik = await factory.ArticleIdAsync("Brik");
        await Put(client, brik);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"api/favoris/{brik}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"api/favoris/{brik}")).StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync("api/favoris/999999")).StatusCode); // jamais ajouté

        Assert.Empty(await Ids(client));
    }

    [Fact]
    public async Task An_unknown_article_returns_404_and_nothing_is_stored()
    {
        var client = await factory.CreateClientForNewUserAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await Put(client, 999999)).StatusCode);

        Assert.Empty(await Ids(client));
    }

    [Fact]
    public async Task An_inactive_article_or_an_article_of_an_inactive_category_is_refused()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var inactive = await factory.ArticleIdAsync("Ancien plat");   // EstActif = false
        var hidden = await factory.ArticleIdAsync("Caché");           // catégorie « Archive » inactive

        Assert.Equal(HttpStatusCode.NotFound, (await Put(client, inactive)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await Put(client, hidden)).StatusCode);
        Assert.Empty(await Ids(client));
    }

    [Fact]
    public async Task An_unavailable_article_can_be_favourited_and_is_listed_as_unavailable()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var soupe = await factory.ArticleIdAsync("Soupe"); // EstDisponible = false, actif

        Assert.Equal(HttpStatusCode.NoContent, (await Put(client, soupe)).StatusCode);

        var item = (await Json(await client.GetAsync("api/favoris"))).EnumerateArray().Single();
        Assert.False(item.GetProperty("disponible").GetBoolean());
        Assert.True(item.GetProperty("actif").GetBoolean());
    }

    // ---------- Liste ----------

    [Fact]
    public async Task The_list_returns_articles_with_all_fields()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var brik = await factory.ArticleIdAsync("Brik");
        await Put(client, brik);

        var fr = (await Json(await client.GetAsync("api/favoris"))).EnumerateArray().Single();

        Assert.Equal("Brik", fr.GetProperty("nom").GetString());
        foreach (var field in new[] { "id", "categorieId", "nom", "description", "prix", "imageUrl", "estPopulaire", "disponible", "actif" })
        {
            Assert.True(fr.TryGetProperty(field, out _), field);
        }

        Assert.Equal(brik, fr.GetProperty("id").GetInt32());
        Assert.Equal(3.5m, fr.GetProperty("prix").GetDecimal());
        Assert.True(fr.GetProperty("estPopulaire").GetBoolean());
        Assert.True(fr.GetProperty("actif").GetBoolean());
    }

    [Fact]
    public async Task The_list_is_sorted_by_article_id_descending_the_model_has_no_date()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var first = await factory.CreateArticleAsync("Fav ordre A");
        var second = await factory.CreateArticleAsync("Fav ordre B");
        await Put(client, second);
        await Put(client, first);   // ajouté en dernier mais id plus petit

        var ids = (await Json(await client.GetAsync("api/favoris"))).EnumerateArray().Select(e => e.GetProperty("id").GetInt32()).ToArray();

        Assert.Equal([second, first], ids);
    }

    [Fact]
    public async Task A_deactivated_article_stays_listed_with_actif_false()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var article = await factory.CreateArticleAsync("Fav bientôt retiré");
        await Put(client, article);
        await factory.SetArticleAsync(article, actif: false);

        var item = (await Json(await client.GetAsync("api/favoris"))).EnumerateArray().Single();

        Assert.Equal(article, item.GetProperty("id").GetInt32());
        Assert.False(item.GetProperty("actif").GetBoolean());
        Assert.Contains(article, await Ids(client)); // les cœurs restent affichables
    }

    [Fact]
    public async Task A_legacy_lang_parameter_is_ignored()
    {
        var client = await factory.CreateClientForNewUserAsync();
        await Put(client, await factory.ArticleIdAsync("Brik"));

        var item = (await Json(await client.GetAsync("api/favoris?lang=ar"))).EnumerateArray().Single();
        Assert.Equal("Brik", item.GetProperty("nom").GetString());
    }

    // ---------- Isolation ----------

    [Fact]
    public async Task Users_never_see_or_remove_each_others_favourites()
    {
        var alice = await factory.CreateClientForNewUserAsync();
        var bob = await factory.CreateClientForNewUserAsync();
        var brik = await factory.ArticleIdAsync("Brik");
        await Put(alice, brik);

        Assert.Empty(await Ids(bob));
        Assert.Empty((await Json(await bob.GetAsync("api/favoris"))).EnumerateArray());
        await bob.DeleteAsync($"api/favoris/{brik}"); // sans effet sur Alice
        Assert.Equal([brik], await Ids(alice));

        await Put(bob, brik);
        await alice.DeleteAsync($"api/favoris/{brik}");
        Assert.Equal([brik], await Ids(bob));
    }

    [Fact]
    public async Task An_admin_has_their_own_favourites_list_too()
    {
        var admin = await factory.CreateClientAsync("admin");

        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("api/favoris")).StatusCode);
    }
}
