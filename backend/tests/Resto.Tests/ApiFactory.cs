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
            _seeded = true;
        }
        finally
        {
            _seedLock.Release();
        }
    }

    private static async Task CreateUserAsync(UserManager<ApplicationUser> users, string name, string role, bool active)
    {
        var user = new ApplicationUser { UserName = name, Email = $"{name}@resto.local", Nom = name, EstActif = active };
        var result = await users.CreateAsync(user, Password);
        Assert.True(result.Succeeded, string.Join(",", result.Errors.Select(e => e.Code)));
        await users.AddToRoleAsync(user, role);
    }
}
