using Microsoft.EntityFrameworkCore;

namespace Resto.Api.Data;

// dotnet run -- --migrate   (dans l'image Docker : dotnet Resto.Api.dll --migrate)
// Applique les migrations EF Core sur la base de ConnectionStrings:Default. L'API ne migre jamais d'elle-même.
public static class MigrateCommand
{
    public const string Flag = "--migrate";

    public static bool IsRequested(string[] args) => args.Contains(Flag);

    // Code de sortie : 0 succès, 1 échec (base injoignable, migration en erreur), 2 arguments incorrects.
    public static Task<int> RunAsync(string[] args, AppDbContext db, TextWriter output, CancellationToken ct = default) =>
        RunAsync(args, c => db.Database.GetPendingMigrationsAsync(c), c => db.Database.MigrateAsync(c), output, ct);

    // Point d'entrée des tests : EF InMemory ne connaît pas les migrations (fournisseur relationnel requis).
    internal static async Task<int> RunAsync(
        string[] args, Func<CancellationToken, Task<IEnumerable<string>>> pendingMigrations,
        Func<CancellationToken, Task> migrate, TextWriter output, CancellationToken ct = default)
    {
        var unknown = args.Where(a => a.StartsWith("--") && a != Flag).ToList();
        if (unknown.Count > 0)
        {
            await output.WriteLineAsync($"Option inconnue : {string.Join(", ", unknown)}.");
            return 2;
        }

        try
        {
            var pending = (await pendingMigrations(ct)).ToList();
            if (pending.Count == 0)
            {
                await output.WriteLineAsync("Base à jour : 0 migration appliquée.");
                return 0;
            }

            await output.WriteLineAsync($"Migrations à appliquer ({pending.Count}) :");
            foreach (var migration in pending)
            {
                await output.WriteLineAsync($"  - {migration}");
            }
            await migrate(ct);
            await output.WriteLineAsync($"APPLIQUÉ : {pending.Count} migration(s) appliquée(s).");
            return 0;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            // Type et message seulement (ni pile ni chaîne de connexion).
            await output.WriteLineAsync($"Échec de la migration ({ex.GetType().Name}) : {ex.Message}");
            return 1;
        }
    }
}
