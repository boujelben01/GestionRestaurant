using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Resto.Api.Common.Validation;
using Resto.Api.Data;

namespace Resto.Tests;

// EF InMemory : vérifie la logique du seed (idempotence, ImageUrl), pas son exécution sur PostgreSQL.
public class SeedTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Seed_image_urls_respect_the_admin_validation_and_seed_is_idempotent()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        await db.Database.EnsureDeletedAsync();

        await DbSeeder.SeedAsync(scope.ServiceProvider);
        var articles = await db.Articles.AsNoTracking().ToListAsync();
        await DbSeeder.SeedAsync(scope.ServiceProvider);

        Assert.NotEmpty(articles);
        Assert.All(articles, a => Assert.True(ImageUrlRules.IsValid(a.ImageUrl), $"{a.NomFr} : {a.ImageUrl}"));
        Assert.Equal(articles.Count, await db.Articles.CountAsync());
        Assert.Equal(7, await db.Horaires.CountAsync());
    }
}
