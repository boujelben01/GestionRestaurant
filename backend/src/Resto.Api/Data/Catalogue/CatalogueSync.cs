using Microsoft.EntityFrameworkCore;

namespace Resto.Api.Data.Catalogue;

// Lit la base, calcule le plan, et l'applique en une transaction. Ne supprime jamais rien.
public static class CatalogueSync
{
    public static async Task<CataloguePlan> PlanAsync(
        AppDbContext db, CatalogueFile file, bool deactivateMissing, CancellationToken ct = default)
    {
        var existing = await db.Categories.Include(c => c.Articles).OrderBy(c => c.Id).ToListAsync(ct);
        return CataloguePlanner.Plan(file, existing, deactivateMissing, DateTime.UtcNow);
    }

    // Le plan est recalculé à l'intérieur de la stratégie d'exécution : en cas de nouvelle tentative
    // (EnableRetryOnFailure), il repart de l'état réel de la base.
    public static async Task<CataloguePlan> ApplyAsync(
        AppDbContext db, CatalogueFile file, bool deactivateMissing, CancellationToken ct = default)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var plan = await PlanAsync(db, file, deactivateMissing, ct);
            foreach (var change in plan.Changes)
            {
                change.Apply?.Invoke(db);
            }
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return plan;
        });
    }
}
