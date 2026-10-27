using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Resto.Api.Data;

namespace Resto.Tests;

// EF InMemory : vérifie la logique du seed (idempotence), pas son exécution sur PostgreSQL.
// Le catalogue n'est plus seedé ici : il vient de Data/catalogue.json (voir CatalogueTests).
public class SeedTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Seed_is_idempotent_and_does_not_touch_the_catalogue()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureDeletedAsync();

        await DbSeeder.SeedAsync(scope.ServiceProvider);
        var tables = await db.Tables.CountAsync();
        await DbSeeder.SeedAsync(scope.ServiceProvider);

        Assert.Equal(7, await db.Horaires.CountAsync());
        Assert.Equal(6, tables);
        Assert.Equal(tables, await db.Tables.CountAsync());
        Assert.Equal(1, await db.ParametresRestaurant.CountAsync());
        Assert.Equal(0, await db.Categories.CountAsync());
        Assert.Equal(0, await db.Articles.CountAsync());
    }
}
