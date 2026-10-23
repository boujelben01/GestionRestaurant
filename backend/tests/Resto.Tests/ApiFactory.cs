using System.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Auth;

namespace Resto.Tests;

// Le fournisseur InMemory ne reproduit ni les contraintes PostgreSQL (CHECK, index uniques, FK)
// ni sa sémantique SQL : il ne sert ici qu'à tester l'autorisation et le flux d'authentification.
public class ApiFactory : WebApplicationFactory<Program>
{
    public const string Password = "Passw0rd!test";

    private readonly string _databaseName = Guid.NewGuid().ToString();
    private readonly SemaphoreSlim _seedLock = new(1, 1);
    private bool _seeded;

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.UseSetting("ConnectionStrings:Default", "Host=unused;Database=unused");
        builder.UseSetting("Jwt:SecretKey", "test-secret-key-test-secret-key-0123456789");

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AppDbContext>>();
            services.AddDbContext<AppDbContext>(options => options.UseInMemoryDatabase(_databaseName));
        });
    }

    public async Task<HttpClient> CreateClientAsync(string? userName = null)
    {
        await EnsureSeededAsync();
        var client = CreateClient();
        if (userName is not null)
        {
            using var scope = Services.CreateScope();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
            var user = (await users.FindByNameAsync(userName))!;
            var token = scope.ServiceProvider.GetRequiredService<ITokenService>()
                .CreateAccessToken(user, await users.GetRolesAsync(user));
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token.Token);
        }
        return client;
    }

    public async Task<string> GetUserIdAsync(string userName)
    {
        using var scope = Services.CreateScope();
        var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();
        return (await users.FindByNameAsync(userName))!.Id;
    }

    private async Task EnsureSeededAsync()
    {
        await _seedLock.WaitAsync();
        try
        {
            if (_seeded)
            {
                return;
            }

            using var scope = Services.CreateScope();
            var roles = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();
            var users = scope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>();

            foreach (var role in new[] { Roles.Admin, Roles.Client })
            {
                await roles.CreateAsync(new IdentityRole(role));
            }

            await CreateUserAsync(users, "admin", Roles.Admin, active: true);
            await CreateUserAsync(users, "client", Roles.Client, active: true);
            await CreateUserAsync(users, "inactif", Roles.Client, active: false);
            await SeedCatalogAsync(scope.ServiceProvider.GetRequiredService<AppDbContext>());
            _seeded = true;
        }
        finally
        {
            _seedLock.Release();
        }
    }

    public async Task<int> ArticleIdAsync(string nomFr)
    {
        await EnsureSeededAsync();
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return (await db.Articles.SingleAsync(a => a.NomFr == nomFr)).Id;
    }

    public async Task<int> CategorieIdAsync(string nomFr)
    {
        await EnsureSeededAsync();
        using var scope = Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return (await db.Categories.SingleAsync(c => c.NomFr == nomFr)).Id;
    }

    private static async Task SeedCatalogAsync(AppDbContext db)
    {
        var entrees = new Categorie { NomFr = "Entrées", NomAr = "المقبلات", Ordre = 1 };
        var archive = new Categorie { NomFr = "Archive", NomAr = "أرشيف", Ordre = 2, EstActive = false };
        db.Categories.AddRange(entrees, archive);
        db.Articles.AddRange(
            new Article { Categorie = entrees, NomFr = "Brik", NomAr = "بريك", Prix = 3.5m, Ordre = 1, EstPopulaire = true, ImageUrl = "/images/brik.jpg" },
            new Article { Categorie = entrees, NomFr = "Soupe", NomAr = "", Prix = 4m, Ordre = 2, EstDisponible = false },
            new Article { Categorie = entrees, NomFr = "Ancien plat", NomAr = "قديم", Prix = 5m, Ordre = 3, EstActif = false },
            new Article { Categorie = archive, NomFr = "Caché", NomAr = "مخفي", Prix = 6m, Ordre = 1 });

        db.ParametresRestaurant.Add(new ParametresRestaurant
        {
            Id = 1, Nom = "Resto", Telephone = "+216 70 000 000", Email = "contact@resto.local",
            Adresse = "Tunis", FraisLivraison = 3m, MontantMinimumLivraison = 15m, CommandesOuvertes = true
        });
        db.Horaires.AddRange(Enumerable.Range(0, 7).Select(day => new Horaire
        {
            JourSemaine = day, Ouverture = new TimeOnly(11, 0), Fermeture = new TimeOnly(23, 0)
        }));
        await db.SaveChangesAsync();
    }

    private static async Task CreateUserAsync(UserManager<ApplicationUser> users, string name, string role, bool active)
    {
        var user = new ApplicationUser { UserName = name, Email = $"{name}@resto.local", Nom = name, EstActif = active };
        var result = await users.CreateAsync(user, Password);
        Assert.True(result.Succeeded, string.Join(",", result.Errors.Select(e => e.Code)));
        await users.AddToRoleAsync(user, role);
    }
}
