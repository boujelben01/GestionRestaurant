using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Resto.Tests;

// EF InMemory : ne reproduit ni les CHECK, ni les index uniques, ni les FK de PostgreSQL.
// Les doublons de nom sont détectés par le service, pas par la base.
public class MenuApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static IEnumerable<string> Names(JsonElement articles, string property = "nom") =>
        articles.EnumerateArray().Select(a => a.GetProperty(property).GetString()!);

    [Fact]
    public async Task Menu_is_public_hides_inactive_items_and_marks_unavailable()
    {
        var client = await factory.CreateClientAsync();

        var response = await client.GetAsync("api/menu");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Contains("max-age=60", response.Headers.CacheControl?.ToString());
        var menu = await Json(response);
        var categorie = Assert.Single(menu.EnumerateArray());
        Assert.Equal("Entrées", categorie.GetProperty("nom").GetString());
        var articles = categorie.GetProperty("articles");
        Assert.Equal(["Brik", "Soupe"], Names(articles));
        Assert.False(articles[1].GetProperty("disponible").GetBoolean());
        Assert.True(articles[0].GetProperty("estPopulaire").GetBoolean());
        Assert.Equal("/images/brik.jpg", articles[0].GetProperty("imageUrl").GetString());
    }

    [Fact]
    public async Task Menu_in_arabic_falls_back_to_french_when_translation_is_empty()
    {
        var client = await factory.CreateClientAsync();

        var menu = await Json(await client.GetAsync("api/menu?lang=ar"));

        var categorie = menu[0];
        Assert.Equal("المقبلات", categorie.GetProperty("nom").GetString());
        Assert.Equal(["بريك", "Soupe"], Names(categorie.GetProperty("articles")));
    }

    [Fact]
    public async Task Unknown_language_is_rejected()
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.BadRequest, (await client.GetAsync("api/menu?lang=de")).StatusCode);
    }

    [Fact]
    public async Task Inactive_article_and_article_of_inactive_category_are_not_returned()
    {
        var client = await factory.CreateClientAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"api/menu/articles/{await factory.ArticleIdAsync("Ancien plat")}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"api/menu/articles/{await factory.ArticleIdAsync("Caché")}")).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"api/menu/articles/{await factory.ArticleIdAsync("Soupe")}")).StatusCode);

        var list = await Json(await client.GetAsync("api/menu/articles?pageSize=500"));
        Assert.Equal(50, list.GetProperty("pageSize").GetInt32());
        Assert.Equal(["Brik", "Soupe"], Names(list.GetProperty("items")));

        var categories = await Json(await client.GetAsync("api/menu/categories"));
        Assert.Equal(1, categories.GetArrayLength());
    }

    [Fact]
    public async Task Article_search_and_popular_filters_work()
    {
        var client = await factory.CreateClientAsync();

        var popular = await Json(await client.GetAsync("api/menu/articles?populaire=true"));
        Assert.Equal(["Brik"], Names(popular.GetProperty("items")));

        var search = await Json(await client.GetAsync("api/menu/articles?recherche=sou"));
        Assert.Equal(["Soupe"], Names(search.GetProperty("items")));
    }

    [Theory]
    [InlineData("api/admin/categories")]
    [InlineData("api/admin/articles")]
    public async Task Admin_menu_requires_admin_role(string url)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await (await factory.CreateClientAsync()).GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden, (await (await factory.CreateClientAsync("client")).GetAsync(url)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await (await factory.CreateClientAsync("admin")).GetAsync(url)).StatusCode);
    }

    [Fact]
    public async Task Admin_categories_list_includes_inactive_ones()
    {
        var client = await factory.CreateClientAsync("admin");

        var list = await Json(await client.GetAsync("api/admin/categories"));

        Assert.Contains(list.EnumerateArray(), c => !c.GetProperty("estActive").GetBoolean());
    }

    [Fact]
    public async Task Articles_and_categories_cannot_be_deleted()
    {
        var client = await factory.CreateClientAsync("admin");
        var articleId = await factory.ArticleIdAsync("Brik");
        var categorieId = await factory.CategorieIdAsync("Entrées");

        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await client.DeleteAsync($"api/admin/articles/{articleId}")).StatusCode);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await client.DeleteAsync($"api/admin/categories/{categorieId}")).StatusCode);
    }

    [Fact]
    public async Task Category_with_active_articles_cannot_be_deactivated()
    {
        var client = await factory.CreateClientAsync("admin");
        var id = await factory.CategorieIdAsync("Entrées");

        var response = await client.PatchAsJsonAsync($"api/admin/categories/{id}/active", new { estActive = false });

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("article(s) actif(s)", (await Json(response)).GetProperty("title").GetString());
    }

    [Fact]
    public async Task Duplicate_category_name_is_rejected_and_empty_category_can_be_deactivated()
    {
        var client = await factory.CreateClientAsync("admin");

        var duplicate = await client.PostAsJsonAsync("api/admin/categories", new { nomFr = "entrées", nomAr = "x" });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);

        var created = await client.PostAsJsonAsync("api/admin/categories", new { nomFr = "Boissons test", nomAr = "مشروبات" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await Json(created)).GetProperty("id").GetInt32();

        var deactivated = await client.PatchAsJsonAsync($"api/admin/categories/{id}/active", new { estActive = false });
        Assert.Equal(HttpStatusCode.OK, deactivated.StatusCode);
        Assert.False((await Json(deactivated)).GetProperty("estActive").GetBoolean());
    }

    [Fact]
    public async Task Article_validation_rejects_bad_input()
    {
        var client = await factory.CreateClientAsync("admin");
        var categorieId = await factory.CategorieIdAsync("Entrées");

        object Body(int cat, decimal prix, string? image) =>
            new { categorieId = cat, nomFr = "Test", nomAr = "اختبار", prix, imageUrl = image };

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("api/admin/articles", Body(99999, 3m, null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("api/admin/articles", Body(categorieId, -1m, null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("api/admin/articles", Body(categorieId, 1.234m, null))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("api/admin/articles", Body(categorieId, 3m, "javascript:alert(1)"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("api/admin/articles", Body(categorieId, 3m, "http://exemple.com/a.png"))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("api/admin/articles", new { categorieId, nomFr = "", nomAr = "", prix = 3m })).StatusCode);
    }

    [Fact]
    public async Task Article_lifecycle_updates_modification_date_and_deactivation_hides_it()
    {
        var client = await factory.CreateClientAsync("admin");
        var categorieId = await factory.CategorieIdAsync("Entrées");

        var created = await client.PostAsJsonAsync("api/admin/articles",
            new { categorieId, nomFr = "Lablabi test", nomAr = "لبلابي", prix = 5.5m, imageUrl = "/images/lablabi.webp" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var article = await Json(created);
        var id = article.GetProperty("id").GetInt32();
        var firstUpdate = article.GetProperty("dateMiseAJour").GetDateTime();

        await Task.Delay(20);
        var updated = await Json(await client.PutAsJsonAsync($"api/admin/articles/{id}",
            new { categorieId, nomFr = "Lablabi test", nomAr = "لبلابي", prix = 6m, estDisponible = true }));
        Assert.True(updated.GetProperty("dateMiseAJour").GetDateTime() > firstUpdate);
        Assert.Equal(6m, updated.GetProperty("prix").GetDecimal());

        var anonymous = await factory.CreateClientAsync();
        Assert.Equal(HttpStatusCode.OK, (await anonymous.GetAsync($"api/menu/articles/{id}")).StatusCode);

        var off = await client.PatchAsJsonAsync($"api/admin/articles/{id}/actif", new { estActif = false });
        Assert.Equal(HttpStatusCode.OK, off.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await anonymous.GetAsync($"api/menu/articles/{id}")).StatusCode);

        var inactive = await Json(await client.GetAsync("api/admin/articles?actif=false&pageSize=50"));
        Assert.Contains(id, inactive.GetProperty("items").EnumerateArray().Select(a => a.GetProperty("id").GetInt32()));
    }

    [Fact]
    public async Task Reorder_rejects_unknown_and_duplicate_ids()
    {
        var client = await factory.CreateClientAsync("admin");
        var id = await factory.CategorieIdAsync("Entrées");

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("api/admin/categories/ordre", new { ids = new[] { id, 99999 } })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await client.PutAsJsonAsync("api/admin/categories/ordre", new { ids = new[] { id, id } })).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PutAsJsonAsync("api/admin/categories/ordre", new { ids = new[] { id } })).StatusCode);
    }
}
