namespace Resto.Api.Data.Catalogue;

// dotnet run -- --seed-catalog [--apply] [--deactivate-missing]
public static class CatalogueCommand
{
    public const string Flag = "--seed-catalog";

    public static bool IsRequested(string[] args) => args.Contains(Flag);

    // Retourne le code de sortie : 0 succès, 1 catalogue invalide, 2 arguments incorrects.
    public static async Task<int> RunAsync(string[] args, AppDbContext db, string path, TextWriter output, CancellationToken ct = default)
    {
        var apply = args.Contains("--apply");
        var deactivateMissing = args.Contains("--deactivate-missing");
        var unknown = args.Where(a => a.StartsWith("--") && a is not (Flag or "--apply" or "--deactivate-missing")).ToList();
        if (unknown.Count > 0)
        {
            await output.WriteLineAsync($"Option inconnue : {string.Join(", ", unknown)}.");
            return 2;
        }
        if (deactivateMissing && !apply)
        {
            await output.WriteLineAsync("--deactivate-missing s'utilise uniquement avec --apply.");
            return 2;
        }

        CatalogueFile file;
        try
        {
            file = CatalogueReader.Read(path);
        }
        catch (CatalogueException ex)
        {
            await output.WriteLineAsync(ex.Message);
            return 1;
        }

        var errors = CatalogueValidator.Validate(file);
        if (errors.Count > 0)
        {
            await output.WriteLineAsync($"Catalogue invalide ({errors.Count} erreur(s)), rien n'a été écrit :");
            foreach (var error in errors)
            {
                await output.WriteLineAsync($"  - {error}");
            }
            return 1;
        }

        var plan = apply
            ? await CatalogueSync.ApplyAsync(db, file, deactivateMissing, ct)
            : await CatalogueSync.PlanAsync(db, file, false, ct);
        await output.WriteLineAsync(apply ? "APPLIQUÉ :" : "SIMULATION (rien n'est écrit ; ajoutez --apply pour appliquer) :");
        await WritePlanAsync(plan, apply, output);
        return 0;
    }

    public static async Task WritePlanAsync(CataloguePlan plan, bool applied, TextWriter output)
    {
        var labels = new (ChangeType Type, string Simulation, string Done)[]
        {
            (ChangeType.Create, "à créer", "créé"),
            (ChangeType.Update, "à modifier", "modifié"),
            (ChangeType.Deactivate, "à désactiver", "désactivé"),
            (ChangeType.Missing, "présent en base mais absent du fichier", "présent en base mais absent du fichier, inchangé"),
        };
        foreach (var (type, simulation, done) in labels)
        {
            foreach (var change in plan.Changes.Where(c => c.Type == type))
            {
                var detail = change.Detail.Length > 0 ? $" ({change.Detail})" : "";
                await output.WriteLineAsync($"  [{(applied ? done : simulation)}] {change.Entity} {change.Name}{detail}");
            }
        }
        await output.WriteLineAsync(
            $"Bilan : {plan.Count(ChangeType.Create)} à créer, {plan.Count(ChangeType.Update)} à modifier, " +
            $"{plan.Count(ChangeType.Unchanged)} inchangé(s), {plan.Count(ChangeType.Deactivate)} à désactiver, " +
            $"{plan.Count(ChangeType.Missing)} présent(s) en base mais absent(s) du fichier.");
    }
}
