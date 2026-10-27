using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Domain;

namespace Resto.Api.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DbSeeder));

        await SeedRolesAsync(services.GetRequiredService<RoleManager<IdentityRole>>());
        await SeedAdminAsync(
            services.GetRequiredService<UserManager<ApplicationUser>>(),
            services.GetRequiredService<IConfiguration>(),
            logger);

        if (!await db.ParametresRestaurant.AnyAsync())
        {
            db.ParametresRestaurant.Add(new ParametresRestaurant
            {
                Id = 1,
                Nom = "Resto",
                Telephone = "+216 70 000 000",
                Email = "contact@resto.local",
                Adresse = "Avenue Habib Bourguiba, Tunis",
                FraisLivraison = 3m,
                MontantMinimumLivraison = 15m,
                CommandesOuvertes = true
            });
        }

        if (!await db.Horaires.AnyAsync())
        {
            db.Horaires.AddRange(Enumerable.Range(0, 7).Select(jour => new Horaire
            {
                JourSemaine = jour,
                Ouverture = new TimeOnly(11, 0),
                Fermeture = new TimeOnly(23, 0),
                EstFerme = false
            }));
        }

        if (!await db.Tables.AnyAsync())
        {
            int[] capacites = [2, 2, 4, 4, 6, 8];
            db.Tables.AddRange(capacites.Select((capacite, i) => new RestaurantTable
            {
                Numero = i + 1,
                Code = Guid.NewGuid(),
                Capacite = capacite,
                EstActive = true
            }));
        }

        await db.SaveChangesAsync();
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        foreach (var role in new[] { Roles.Admin, Roles.Client })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                (await roleManager.CreateAsync(new IdentityRole(role))).ThrowIfFailed($"création du rôle {role}");
            }
        }
    }

    private static async Task SeedAdminAsync(UserManager<ApplicationUser> userManager, IConfiguration config, ILogger logger)
    {
        if (await userManager.FindByNameAsync("admin") is not null)
        {
            return;
        }

        var password = config["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Seed:AdminPassword est absent : le compte admin n'est pas créé.");
            return;
        }

        var admin = new ApplicationUser
        {
            UserName = "admin",
            Email = "admin@resto.local",
            EmailConfirmed = true,
            Nom = "Administrateur"
        };
        (await userManager.CreateAsync(admin, password)).ThrowIfFailed("création du compte admin");
        (await userManager.AddToRoleAsync(admin, Roles.Admin)).ThrowIfFailed("attribution du rôle Admin");
    }

    private static void ThrowIfFailed(this IdentityResult result, string action)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Échec ({action}) : {string.Join(", ", result.Errors.Select(e => e.Code))}");
        }
    }
}
