using Resto.Api.Domain;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Commandes.Admin;
using Resto.Api.Features.Panier;

namespace Resto.Api.Data.Demo;

/// <summary>
/// Repère des comptes de démo. Le domaine test.com existe réellement : il ne suffit PAS. Un compte est « de démo »
/// si son e-mail figure exactement dans demo.json ET si son téléphone commence par +2162000.
/// </summary>
public static class DemoAccounts
{
    public const string TelephonePrefix = "+2162000";

    public static string Normalize(string email) => email.Trim().ToUpperInvariant();

    public static bool IsDemo(string? email, string? telephone, IReadOnlySet<string> normalizedDemoEmails) =>
        email is not null
        && normalizedDemoEmails.Contains(Normalize(email))
        && telephone is not null
        && telephone.StartsWith(TelephonePrefix, StringComparison.Ordinal);
}

public sealed record ExistingUser(
    string Id, string? Email, string? NormalizedEmail, string? NormalizedUserName, string? PhoneNumber,
    DateTime DateCreation, bool IsAdmin);

/// <summary>État de la base nécessaire au plan (lu par DemoSync, construit à la main dans les tests).</summary>
public sealed record DemoSnapshot(
    IReadOnlyList<ExistingUser> Users,
    IReadOnlyList<Article> Articles,
    IReadOnlyList<RestaurantTable> Tables,
    ParametresRestaurant? Parametres,
    bool ClientRoleExists,
    IReadOnlyList<Adresse> Adresses,
    IReadOnlyList<Favori> Favoris,
    int DemoOrders);

public sealed record AccountPlan(string Cle, string Email, string Nom, string Telephone, bool Actif, DateTime DateCreation, string? ExistingId);
public sealed record AdressePlan(string Cle, string Libelle, DemoAdresse Source, string Telephone, bool ParDefaut, bool Exists);
public sealed record FavoriPlan(string Cle, string Nom, int ArticleId, bool Exists);

public sealed record DemoPlan(
    IReadOnlyList<string> Errors,
    IReadOnlyList<string> Notices,
    IReadOnlyList<AccountPlan> Accounts,
    IReadOnlyList<AdressePlan> Adresses,
    IReadOnlyList<FavoriPlan> Favoris,
    IReadOnlyList<GeneratedOrder> Orders,
    bool OrdersSkipped,
    DateOnly Du,
    DateOnly Au)
{
    public bool IsValid => Errors.Count == 0;
}

/// <summary>Calcule ce qui serait créé, sans rien écrire. Toutes les erreurs sont listées ensemble.</summary>
public static class DemoPlanner
{
    public static DemoPlan Plan(DemoFile file, DemoSnapshot snapshot, DateTimeOffset nowUtc, TimeZoneInfo zone)
    {
        var errors = new List<string>();
        var notices = new List<string>();
        var today = TunisDay.Bounds(nowUtc, zone).Date;
        var du = today.AddDays(1 - file.Reglages!.Jours!.Value);

        if (!snapshot.ClientRoleExists) errors.Add("Le rôle Client n'existe pas : lancez d'abord le seed de l'application (dotnet run -- --seed).");
        if (snapshot.Parametres is null) errors.Add("Les paramètres du restaurant sont absents : lancez d'abord le seed de l'application (dotnet run -- --seed).");

        var pool = snapshot.Articles
            .Where(a => ArticleAvailability.Of(a) == ArticleStatus.Ok)
            .OrderBy(a => a.Id)
            .Select(a => new DemoArticleRef(a.Id, a.Categorie.NomFr, a.NomFr, a.Prix, a.EstPopulaire))
            .ToList();
        if (pool.Count == 0) errors.Add("Le catalogue ne contient aucun article actif et disponible : lancez d'abord --seed-catalog --apply.");

        var accounts = PlanAccounts(file, snapshot, today, zone, errors);
        var adresses = PlanAdresses(file, snapshot, accounts);
        var favoris = PlanFavoris(file, snapshot, accounts, errors);
        var manuelles = ResolveManuelles(file, snapshot, errors);

        var orders = new List<GeneratedOrder>();
        var skipped = snapshot.DemoOrders > 0;
        if (skipped)
        {
            notices.Add($"{snapshot.DemoOrders} commande(s) de comptes de démo existent déjà : la partie commandes est ignorée " +
                        "(les dates sont relatives à aujourd'hui ; --reset-demo --apply puis --seed-demo --apply pour les régénérer).");
        }
        else if (errors.Count == 0)
        {
            var clients = accounts.Select(a => new DemoClient(
                a.Cle, a.Nom, a.Telephone, a.Actif, a.DateCreation,
                adresses.Where(x => x.Cle == a.Cle)
                    .Select(x => new DemoAdresseRef(x.Libelle, DemoValidator.DeliveryLine(x.Source), x.Telephone))
                    .ToList())).ToList();
            var tables = snapshot.Tables.Where(t => t.EstActive).Select(t => new DemoTableRef(t.Id, t.Numero)).ToList();
            var restaurant = new DemoRestaurant(snapshot.Parametres!.FraisLivraison, snapshot.Parametres.MontantMinimumLivraison);
            var generation = DemoGenerator.Generate(file.Reglages, clients, pool, tables, restaurant, manuelles, nowUtc, zone);
            orders.AddRange(generation.Orders);
            notices.AddRange(generation.Notices);
        }

        return new DemoPlan(errors, notices, accounts, adresses, favoris, orders, skipped, du, today);
    }

    private static List<AccountPlan> PlanAccounts(
        DemoFile file, DemoSnapshot snapshot, DateOnly today, TimeZoneInfo zone, List<string> errors)
    {
        var demoEmails = file.Utilisateurs!.Select(u => DemoAccounts.Normalize(u.Email!)).ToHashSet();
        var accounts = new List<AccountPlan>();
        for (var i = 0; i < file.Utilisateurs!.Count; i++)
        {
            var u = file.Utilisateurs[i];
            var email = u.Email!.Trim();
            var normalized = DemoAccounts.Normalize(email);
            var matches = snapshot.Users
                .Where(x => x.NormalizedEmail == normalized || x.NormalizedUserName == normalized)
                .ToList();

            ExistingUser? existing = null;
            foreach (var match in matches)
            {
                if (match.IsAdmin)
                {
                    errors.Add($"Conflit : le compte {email} existe et a le rôle Admin ; il n'est jamais modifié ni utilisé pour la démo.");
                }
                else if (match.NormalizedEmail != normalized || !DemoAccounts.IsDemo(match.Email, match.PhoneNumber, demoEmails))
                {
                    errors.Add($"Conflit : un compte qui n'est pas de démo utilise déjà {email} (comme e-mail ou identifiant, " +
                               $"téléphone ne commençant pas par {DemoAccounts.TelephonePrefix}) ; rien n'est écrit.");
                }
                else
                {
                    existing = match;
                }
            }

            // Inscription à 9 h (heure de Tunis) + quelques minutes, « creeIlYaJours » jours avant aujourd'hui.
            var created = existing?.DateCreation
                ?? DemoGenerator.ToUtc(today.AddDays(-u.CreeIlYaJours!.Value).ToDateTime(new TimeOnly(9, (i * 7) % 60)), zone);
            accounts.Add(new AccountPlan(
                u.Cle!.Trim(), email, u.Nom!.Trim(), u.Telephone!.Trim(), u.Actif!.Value,
                DateTime.SpecifyKind(created, DateTimeKind.Utc), existing?.Id));
        }
        return accounts;
    }

    private static List<AdressePlan> PlanAdresses(DemoFile file, DemoSnapshot snapshot, List<AccountPlan> accounts)
    {
        var plans = new List<AdressePlan>();
        foreach (var (u, account) in file.Utilisateurs!.Zip(accounts))
        {
            var existing = account.ExistingId is null ? [] : snapshot.Adresses.Where(a => a.UserId == account.ExistingId).ToList();
            var hasDefault = existing.Any(a => a.EstParDefaut);
            foreach (var a in u.Adresses ?? [])
            {
                var libelle = a.Libelle!.Trim();
                var exists = existing.Any(e => string.Equals(e.Libelle, libelle, StringComparison.OrdinalIgnoreCase));
                // Une seule adresse par défaut (règle d'AdresseService) : on ne retire jamais la défaut d'une adresse existante.
                var parDefaut = !exists && a.ParDefaut == true && !hasDefault;
                plans.Add(new AdressePlan(account.Cle, libelle, a, a.Telephone?.Trim() ?? account.Telephone, parDefaut, exists));
            }
        }
        return plans;
    }

    private static List<FavoriPlan> PlanFavoris(DemoFile file, DemoSnapshot snapshot, List<AccountPlan> accounts, List<string> errors)
    {
        var plans = new List<FavoriPlan>();
        foreach (var (u, account) in file.Utilisateurs!.Zip(accounts))
        {
            foreach (var f in u.Favoris ?? [])
            {
                var article = Find(snapshot, f.Categorie, f.Article);
                var name = $"{f.Categorie!.Trim()} > {f.Article!.Trim()}";
                if (article is null)
                {
                    errors.Add($"Utilisateur « {account.Cle} », favori : article « {name} » introuvable dans le catalogue.");
                    continue;
                }
                // Même règle que FavoriService : un article inactif (ou de catégorie inactive) ne peut pas être ajouté.
                if (ArticleAvailability.Of(article) == ArticleStatus.Inactif)
                {
                    errors.Add($"Utilisateur « {account.Cle} », favori : article « {name} » inactif.");
                    continue;
                }
                var exists = account.ExistingId is not null
                             && snapshot.Favoris.Any(x => x.UserId == account.ExistingId && x.ArticleId == article.Id);
                plans.Add(new FavoriPlan(account.Cle, name, article.Id, exists));
            }
        }
        return plans;
    }

    private static List<DemoManualOrder> ResolveManuelles(DemoFile file, DemoSnapshot snapshot, List<string> errors)
    {
        var result = new List<DemoManualOrder>();
        var manuelles = file.CommandesManuelles ?? [];
        for (var i = 0; i < manuelles.Count; i++)
        {
            var m = manuelles[i];
            var where = $"Commande manuelle n°{i + 1}";
            var user = file.Utilisateurs!.First(u => u.Cle!.Trim() == m.Utilisateur!.Trim());
            var type = DemoValidator.ParseType(m.Type)!.Value;
            var ok = true;

            DemoTableRef? table = null;
            if (type == TypeCommande.SurPlace)
            {
                var t = snapshot.Tables.FirstOrDefault(x => x.Numero == m.Table);
                if (t is null) { errors.Add($"{where} : table n°{m.Table} inexistante."); ok = false; }
                else if (!t.EstActive) { errors.Add($"{where} : table n°{m.Table} inactive."); ok = false; }
                else table = new DemoTableRef(t.Id, t.Numero);
            }

            DemoAdresseRef? adresse = null;
            if (type == TypeCommande.Livraison)
            {
                var a = user.Adresses!.First(x => string.Equals(x.Libelle!.Trim(), m.Adresse!.Trim(), StringComparison.OrdinalIgnoreCase));
                adresse = new DemoAdresseRef(a.Libelle!.Trim(), DemoValidator.DeliveryLine(a), a.Telephone?.Trim() ?? user.Telephone!.Trim());
            }

            var lignes = new List<(DemoArticleRef, int)>();
            foreach (var l in m.Lignes!)
            {
                var article = Find(snapshot, l.Categorie, l.Article);
                var name = $"{l.Categorie!.Trim()} > {l.Article!.Trim()}";
                var status = article is null ? (ArticleStatus?)null : ArticleAvailability.Of(article);
                if (status != ArticleStatus.Ok)
                {
                    errors.Add($"{where} : article « {name} » " + (status is null ? "introuvable dans le catalogue." : "inactif ou indisponible."));
                    ok = false;
                    continue;
                }
                lignes.Add((new DemoArticleRef(article!.Id, article.Categorie.NomFr, article.NomFr, article.Prix, article.EstPopulaire), l.Quantite!.Value));
            }

            if (ok && type == TypeCommande.Livraison && snapshot.Parametres is { } p)
            {
                var sousTotal = lignes.Sum(l => CommandeRules.Round(l.Item1.Prix * l.Item2));
                if (sousTotal < p.MontantMinimumLivraison)
                {
                    errors.Add($"{where} : sous-total {sousTotal} DT inférieur au minimum de livraison ({p.MontantMinimumLivraison} DT).");
                    ok = false;
                }
            }

            if (ok)
            {
                result.Add(new DemoManualOrder(
                    i, user.Cle!.Trim(), type, table, adresse, m.IlYaJours!.Value, DemoValidator.ParseHeure(m.Heure)!.Value,
                    DemoValidator.ParseStatut(m.Statut)!.Value, m.Paye!.Value, lignes));
            }
        }
        return result;
    }

    private static Article? Find(DemoSnapshot snapshot, string? categorie, string? article) =>
        snapshot.Articles
            .Where(a => DemoValidator.Key(a.Categorie.NomFr, a.NomFr) == DemoValidator.Key(categorie, article))
            .OrderBy(a => a.Id)
            .FirstOrDefault();
}
