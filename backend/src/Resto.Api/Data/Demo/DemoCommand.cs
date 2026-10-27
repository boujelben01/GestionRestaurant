using System.Globalization;
using Microsoft.AspNetCore.Identity;
using Resto.Api.Domain;
using Resto.Api.Features.Restaurant;

namespace Resto.Api.Data.Demo;

// dotnet run -- --seed-demo [--apply] [--reset-demo] [--allow-production]
public static class DemoCommand
{
    public const string Flag = "--seed-demo";
    public const string PasswordKey = "Seed:DemoPassword";
    private static readonly string[] Known = [Flag, "--apply", "--reset-demo", "--allow-production"];
    private static readonly CultureInfo Fr = CultureInfo.GetCultureInfo("fr-FR");

    public static bool IsRequested(string[] args) => args.Contains(Flag);

    // Code de sortie : 0 succès, 1 refus (fichier invalide, conflit, mot de passe absent, Production...), 2 arguments incorrects.
    // Le mot de passe n'est jamais affiché, ni aucune chaîne de connexion.
    public static async Task<int> RunAsync(
        string[] args, AppDbContext db, UserManager<ApplicationUser> users, string? password, string environment,
        string path, TextWriter output, DateTimeOffset nowUtc, CancellationToken ct = default)
    {
        var unknown = args.Where(a => a.StartsWith("--") && !Known.Contains(a)).ToList();
        if (unknown.Count > 0)
        {
            await output.WriteLineAsync($"Option inconnue : {string.Join(", ", unknown)}.");
            return 2;
        }
        var apply = args.Contains("--apply");
        var reset = args.Contains("--reset-demo");

        if (string.Equals(environment, Environments.Production, StringComparison.OrdinalIgnoreCase) && !args.Contains("--allow-production"))
        {
            await output.WriteLineAsync("Refusé : ASPNETCORE_ENVIRONMENT=Production. Ajoutez --allow-production si c'est vraiment voulu.");
            return 1;
        }

        DemoFile file;
        try
        {
            file = DemoReader.Read(path);
        }
        catch (DemoException ex)
        {
            await output.WriteLineAsync(ex.Message);
            return 1;
        }

        if (reset)
        {
            return await ResetAsync(db, file, apply, output, ct);
        }

        if (string.IsNullOrWhiteSpace(password))
        {
            await output.WriteLineAsync($"Refusé : {PasswordKey} est absent. Définissez-le (user-secrets en local, variable Seed__DemoPassword ailleurs).");
            return 1;
        }
        var passwordErrors = await PasswordErrorsAsync(users, password);
        if (passwordErrors.Count > 0)
        {
            await output.WriteLineAsync($"Refusé : {PasswordKey} ne respecte pas les règles Identity ({string.Join(", ", passwordErrors)}).");
            return 1;
        }

        var errors = DemoValidator.Validate(file);
        if (errors.Count > 0)
        {
            await WriteErrorsAsync(output, "Fichier de démonstration invalide", errors);
            return 1;
        }

        DemoPlan plan;
        try
        {
            plan = apply
                ? await DemoSync.ApplyAsync(db, users, file, password, nowUtc, ct)
                : await DemoSync.PlanAsync(db, file, nowUtc, ct);
        }
        catch (DemoException ex)
        {
            await output.WriteLineAsync($"{ex.Message} Rien n'a été écrit.");
            return 1;
        }

        if (!plan.IsValid)
        {
            await WriteErrorsAsync(output, "Données de démonstration refusées", plan.Errors);
            return 1;
        }

        await output.WriteLineAsync(apply ? "APPLIQUÉ :" : "SIMULATION (rien n'est écrit ; ajoutez --apply pour appliquer) :");
        await WritePlanAsync(plan, apply, output);
        return 0;
    }

    private static async Task<List<string>> PasswordErrorsAsync(UserManager<ApplicationUser> users, string password)
    {
        var codes = new List<string>();
        foreach (var validator in users.PasswordValidators)
        {
            var result = await validator.ValidateAsync(users, new ApplicationUser(), password);
            codes.AddRange(result.Errors.Select(e => e.Code));
        }
        return codes;
    }

    private static async Task<int> ResetAsync(AppDbContext db, DemoFile file, bool apply, TextWriter output, CancellationToken ct)
    {
        var plan = await DemoSync.ResetPlanAsync(db, file, ct);
        await output.WriteLineAsync(apply
            ? "SUPPRESSION des comptes de démo (e-mail de demo.json ET téléphone +2162000...) :"
            : "SIMULATION de --reset-demo (rien n'est supprimé ; ajoutez --apply pour supprimer) :");
        await WriteResetAsync(plan, output);
        if (apply && plan.Accounts.Count > 0)
        {
            await DemoSync.ResetAsync(db, file, ct);
            await output.WriteLineAsync("Supprimé.");
        }
        return 0;
    }

    public static async Task WriteResetAsync(ResetPlan plan, TextWriter output)
    {
        foreach (var a in plan.Accounts)
        {
            await output.WriteLineAsync($"  [compte] {a.Email} ({a.Nom})");
        }
        foreach (var e in plan.Excluded)
        {
            await output.WriteLineAsync($"  [ignoré] {e}");
        }
        await output.WriteLineAsync(
            $"Bilan : {plan.Accounts.Count} compte(s), {plan.Commandes} commande(s), {plan.Lignes} ligne(s), " +
            $"{plan.Historique} entrée(s) d'historique, {plan.Favoris} favori(s), {plan.Adresses} adresse(s), {plan.Paniers} panier(s).");
    }

    public static async Task WritePlanAsync(DemoPlan plan, bool applied, TextWriter output)
    {
        string State(bool exists) => exists ? "existe déjà" : applied ? "créé" : "à créer";

        await output.WriteLineAsync("Comptes (rôle Client) :");
        foreach (var a in plan.Accounts)
        {
            var adresses = plan.Adresses.Where(x => x.Cle == a.Cle).ToList();
            var favoris = plan.Favoris.Where(x => x.Cle == a.Cle).ToList();
            await output.WriteLineAsync(
                $"  [{State(a.ExistingId is not null)}] {a.Email} ({a.Nom}{(a.Actif ? "" : ", inactif")}, inscrit le " +
                $"{TunisDate(a.DateCreation):yyyy-MM-dd}) : {adresses.Count(x => !x.Exists)}/{adresses.Count} adresse(s), " +
                $"{favoris.Count(x => !x.Exists)}/{favoris.Count} favori(s) {(applied ? "créé(s)" : "à créer")}");
        }
        await output.WriteLineAsync(
            $"  Total : {plan.Accounts.Count(a => a.ExistingId is null)} compte(s), {plan.Adresses.Count(a => !a.Exists)} adresse(s), " +
            $"{plan.Favoris.Count(f => !f.Exists)} favori(s) {(applied ? "créé(s)" : "à créer")}.");

        foreach (var notice in plan.Notices)
        {
            await output.WriteLineAsync($"Remarque : {notice}");
        }
        if (plan.OrdersSkipped)
        {
            return;
        }

        var orders = plan.Orders;
        var perDay = orders.GroupBy(o => TunisDate(o.DateCommande)).ToDictionary(g => g.Key, g => g.Count());
        var days = Enumerable.Range(0, plan.Au.DayNumber - plan.Du.DayNumber + 1).Select(i => plan.Du.AddDays(i)).ToList();
        var counts = days.Select(d => perDay.GetValueOrDefault(d)).ToList();
        await output.WriteLineAsync(
            $"Commandes {(applied ? "créées" : "à créer")} : {orders.Count} ({orders.Count(o => o.Manuelle)} manuelle(s)), " +
            $"du {plan.Du:yyyy-MM-dd} au {plan.Au:yyyy-MM-dd} (heure de Tunis).");
        if (counts.Count > 0)
        {
            await output.WriteLineAsync(
                $"  Par jour : min {counts.Min()}, moyenne {counts.Average().ToString("0.0", Fr)}, max {counts.Max()} ; aujourd'hui {counts[^1]}.");
            var byWeekday = days.Zip(counts).GroupBy(x => x.First.DayOfWeek)
                .OrderBy(g => ((int)g.Key + 6) % 7)
                .Select(g => $"{Fr.DateTimeFormat.GetAbbreviatedDayName(g.Key)} {g.Average(x => x.Second).ToString("0.0", Fr)}");
            await output.WriteLineAsync($"  Moyenne par jour de semaine : {string.Join(", ", byWeekday)}.");
        }
        await output.WriteLineAsync("  Par statut : " + string.Join(", ",
            Enum.GetValues<StatutCommande>().Select(s => $"{s} {orders.Count(o => o.Statut == s)}")));
        await output.WriteLineAsync("  Par type : " + string.Join(", ",
            Enum.GetValues<TypeCommande>().Select(t => $"{t} {orders.Count(o => o.Type == t)}")));
        // Même définition que les statistiques : toutes les commandes non annulées.
        var ca = orders.Where(o => o.Statut != StatutCommande.Annulee).Sum(o => o.Total);
        await output.WriteLineAsync($"  Chiffre d'affaires (hors annulées) : {ca.ToString("0.00", CultureInfo.InvariantCulture)} DT.");
    }

    private static async Task WriteErrorsAsync(TextWriter output, string title, IReadOnlyList<string> errors)
    {
        await output.WriteLineAsync($"{title} ({errors.Count} erreur(s)), rien n'a été écrit :");
        foreach (var error in errors)
        {
            await output.WriteLineAsync($"  - {error}");
        }
    }

    private static DateOnly TunisDate(DateTime utc) =>
        DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), OpeningHours.TunisZone));
}
