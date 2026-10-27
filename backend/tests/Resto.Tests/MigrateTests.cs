using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Resto.Api.Data;

namespace Resto.Tests;

// EF InMemory ne connaît pas les migrations : la logique de la commande est testée avec des migrations simulées,
// l'appel réel avec Npgsql vers un port fermé de la machine locale (aucune vraie base n'est contactée).
public class MigrateTests
{
    private static async Task<(int Code, int MigrateCalls)> RunAsync(StringWriter output, string[] pending, params string[] args)
    {
        var calls = 0;
        var code = await MigrateCommand.RunAsync(
            ["--migrate", .. args],
            _ => Task.FromResult<IEnumerable<string>>(pending),
            _ => { calls++; return Task.CompletedTask; },
            output);
        return (code, calls);
    }

    [Fact]
    public async Task Pending_migrations_are_listed_applied_and_counted()
    {
        var output = new StringWriter();

        var (code, calls) = await RunAsync(output, ["20261023171029_InitialCreate", "20261027164849_SupprimerArabe"]);

        Assert.Equal(0, code);
        Assert.Equal(1, calls);
        Assert.Contains("Migrations à appliquer (2)", output.ToString());
        Assert.Contains("  - 20261027164849_SupprimerArabe", output.ToString());
        Assert.Contains("2 migration(s) appliquée(s)", output.ToString());
    }

    [Fact]
    public async Task Up_to_date_database_is_not_migrated()
    {
        var output = new StringWriter();

        var (code, calls) = await RunAsync(output, []);

        Assert.Equal(0, code);
        Assert.Equal(0, calls);
        Assert.Contains("0 migration appliquée", output.ToString());
    }

    [Fact]
    public async Task Unknown_option_is_rejected_without_touching_the_database()
    {
        var output = new StringWriter();

        var (code, calls) = await RunAsync(output, ["20261023171029_InitialCreate"], "--apply");

        Assert.Equal(2, code);
        Assert.Equal(0, calls);
        Assert.Contains("Option inconnue : --apply", output.ToString());
    }

    [Fact]
    public async Task Failing_migration_returns_1()
    {
        var output = new StringWriter();

        var code = await MigrateCommand.RunAsync(
            ["--migrate"],
            _ => Task.FromResult<IEnumerable<string>>(["20261023171029_InitialCreate"]),
            _ => throw new InvalidOperationException("boom"),
            output);

        Assert.Equal(1, code);
        Assert.Contains("Échec de la migration (InvalidOperationException) : boom", output.ToString());
        Assert.DoesNotContain("APPLIQUÉ", output.ToString());
    }

    [Fact]
    public async Task Non_relational_provider_is_refused()
    {
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
            .Options);
        var output = new StringWriter();

        var code = await MigrateCommand.RunAsync(["--migrate"], db, output);

        Assert.Equal(1, code);
        Assert.Contains("Échec de la migration", output.ToString());
    }

    [Fact]
    public async Task Unreachable_database_returns_1_without_printing_the_connection_string()
    {
        // Port 1 de la machine locale : connexion refusée immédiatement. Mot de passe factice de TEST.
        const string password = "pwd-factice-de-test";
        await using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql($"Host=127.0.0.1;Port=1;Database=resto;Username=resto;Password={password};Timeout=5")
            .Options);
        var output = new StringWriter();

        var code = await MigrateCommand.RunAsync(["--migrate"], db, output);

        Assert.Equal(1, code);
        Assert.Contains("Échec de la migration", output.ToString());
        Assert.DoesNotContain(password, output.ToString());
    }

    [Fact]
    public void The_assembly_ships_the_migrations_applied_by_the_command()
    {
        using var db = new AppDbContext(new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql("Host=unused;Database=unused")
            .Options);

        var migrations = db.Database.GetMigrations().ToList();

        Assert.Contains("20261023171029_InitialCreate", migrations);
        Assert.Contains("20261027164849_SupprimerArabe", migrations);
    }
}
