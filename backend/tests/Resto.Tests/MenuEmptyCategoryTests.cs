using System.Text.Json;
using Microsoft.Extensions.DependencyInjection;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Tests;

// Fixture propre à la classe : la catégorie vide ne perturbe pas les autres tests du menu.
public class MenuEmptyCategoryTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Public_menu_hides_categories_without_active_articles()
    {
        var client = await factory.CreateClientAsync();
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Categories.Add(new Categorie { NomFr = "Vide", NomAr = "فارغة", Ordre = 50 });
            var inactiveOnly = new Categorie { NomFr = "Seulement inactifs", NomAr = "x", Ordre = 51 };
            inactiveOnly.Articles.Add(new Article { NomFr = "Ancien", NomAr = "قديم", Prix = 1m, EstActif = false });
            db.Categories.Add(inactiveOnly);
            await db.SaveChangesAsync();
        }

        var menu = await Names("api/menu", client);
        var categories = await Names("api/menu/categories", client);

        Assert.Equal(["Entrées"], menu);
        Assert.Equal(["Entrées"], categories);
    }

    private static async Task<string[]> Names(string url, HttpClient client)
    {
        using var doc = JsonDocument.Parse(await client.GetStringAsync(url));
        return doc.RootElement.EnumerateArray().Select(c => c.GetProperty("nom").GetString()!).ToArray();
    }
}
