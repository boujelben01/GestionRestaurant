using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Domain;
using Resto.Api.Features.Restaurant;

namespace Resto.Api.Data.Demo;

public sealed record ResetAccount(string Id, string Email, string? Nom);

public sealed record ResetPlan(
    IReadOnlyList<ResetAccount> Accounts, IReadOnlyList<string> Excluded,
    int Commandes, int Lignes, int Historique, int Favoris, int Adresses, int Paniers);

/// <summary>
/// Lit la base, calcule le plan et l'applique en une transaction. Ne touche jamais aux comptes qui ne sont pas
/// « de démo » (DemoAccounts), ni au catalogue, aux tables, aux horaires ou aux paramètres (lecture seule).
/// </summary>
public static class DemoSync
{
    private static readonly TimeZoneInfo Zone = OpeningHours.TunisZone;

    // ---------- Requêtes (internal static) : vérifiées par SqlTranslationTests avec le fournisseur Npgsql ----------

    internal sealed record UserRow
    {
        public string Id { get; init; } = string.Empty;
        public string? Email { get; init; }
        public string? NormalizedEmail { get; init; }
        public string? NormalizedUserName { get; init; }
        public string? PhoneNumber { get; init; }
        public string? Nom { get; init; }
        public DateTime DateCreation { get; init; }
    }

    /// <summary>Comptes dont l'e-mail OU l'identifiant normalisé correspond à un e-mail du fichier.</summary>
    internal static IQueryable<UserRow> MatchingUsersQuery(AppDbContext db, IReadOnlyCollection<string> normalizedEmails) =>
        db.Users.AsNoTracking()
            .Where(u => (u.NormalizedEmail != null && normalizedEmails.Contains(u.NormalizedEmail))
                        || (u.NormalizedUserName != null && normalizedEmails.Contains(u.NormalizedUserName)))
            .OrderBy(u => u.Id)
            .Select(u => new UserRow
            {
                Id = u.Id,
                Email = u.Email,
                NormalizedEmail = u.NormalizedEmail,
                NormalizedUserName = u.NormalizedUserName,
                PhoneNumber = u.PhoneNumber,
                Nom = u.Nom,
                DateCreation = u.DateCreation
            });

    internal static IQueryable<string> AdminIdsQuery(AppDbContext db, IReadOnlyCollection<string> userIds) =>
        db.UserRoles.AsNoTracking()
            .Where(ur => userIds.Contains(ur.UserId) && db.Roles.Any(r => r.Id == ur.RoleId && r.Name == Roles.Admin))
            .Select(ur => ur.UserId);

    internal static IQueryable<Commande> OrdersOfQuery(AppDbContext db, IReadOnlyCollection<string> userIds) =>
        db.Commandes.Where(c => c.UserId != null && userIds.Contains(c.UserId));

    // ---------- Seed ----------

    public static async Task<DemoPlan> PlanAsync(AppDbContext db, DemoFile file, DateTimeOffset nowUtc, CancellationToken ct = default)
    {
        var snapshot = await LoadSnapshotAsync(db, file, ct);
        return DemoPlanner.Plan(file, snapshot, nowUtc, Zone);
    }

    // Le plan est recalculé dans la stratégie d'exécution (EnableRetryOnFailure) : une nouvelle tentative repart de
    // l'état réel. En cas d'erreur, rien n'est validé (la transaction n'est pas commitée).
    public static async Task<DemoPlan> ApplyAsync(
        AppDbContext db, UserManager<ApplicationUser> users, DemoFile file, string password, DateTimeOffset nowUtc,
        CancellationToken ct = default)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var plan = await PlanAsync(db, file, nowUtc, ct);
            if (!plan.IsValid)
            {
                return plan;
            }

            var ids = await CreateAccountsAsync(users, plan, password);
            foreach (var a in plan.Adresses.Where(a => !a.Exists))
            {
                db.Adresses.Add(new Adresse
                {
                    UserId = ids[a.Cle],
                    Libelle = a.Libelle,
                    Ligne = a.Source.Ligne!.Trim(),
                    Ville = a.Source.Ville!.Trim(),
                    Details = string.IsNullOrWhiteSpace(a.Source.Details) ? null : a.Source.Details.Trim(),
                    Telephone = a.Telephone,
                    EstParDefaut = a.ParDefaut
                });
            }
            foreach (var f in plan.Favoris.Where(f => !f.Exists))
            {
                db.Favoris.Add(new Favori { UserId = ids[f.Cle], ArticleId = f.ArticleId });
            }

            var commandes = plan.Orders.Select(o => ToCommande(o, ids[o.ClientCle])).ToList();
            db.Commandes.AddRange(commandes);
            await db.SaveChangesAsync(ct);

            // Numéro définitif comme CommandeService : CMD-{Id:D6}, après obtention de l'identifiant.
            commandes.ForEach(c => c.Numero = $"CMD-{c.Id:D6}");
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return plan;
        });
    }

    private static async Task<Dictionary<string, string>> CreateAccountsAsync(
        UserManager<ApplicationUser> users, DemoPlan plan, string password)
    {
        var ids = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var a in plan.Accounts)
        {
            if (a.ExistingId is not null)
            {
                ids[a.Cle] = a.ExistingId;
                continue;
            }

            var user = new ApplicationUser
            {
                UserName = a.Email,
                Email = a.Email,
                Nom = a.Nom,
                PhoneNumber = a.Telephone,
                LangueFavorite = "fr",
                DateCreation = a.DateCreation,
                EstActif = a.Actif
            };
            // Règles Identity (mot de passe, unicité) appliquées par UserManager ; seuls les codes d'erreur sont affichés.
            var created = await users.CreateAsync(user, password);
            if (!created.Succeeded)
            {
                throw new DemoException($"Création du compte {a.Email} refusée : {string.Join(", ", created.Errors.Select(e => e.Code))}.");
            }
            var role = await users.AddToRoleAsync(user, Roles.Client);
            if (!role.Succeeded)
            {
                throw new DemoException($"Attribution du rôle Client à {a.Email} refusée : {string.Join(", ", role.Errors.Select(e => e.Code))}.");
            }
            ids[a.Cle] = user.Id;
        }
        return ids;
    }

    private static Commande ToCommande(GeneratedOrder o, string userId) => new()
    {
        Numero = "TMP-" + Guid.NewGuid().ToString("N")[..16],
        UserId = userId,
        NomClient = o.NomClient,
        Telephone = o.Telephone,
        Statut = o.Statut,
        TypeCommande = o.Type,
        ModePaiement = ModePaiement.Especes,
        EstPayee = o.EstPayee,
        SousTotal = o.SousTotal,
        FraisLivraison = o.FraisLivraison,
        Total = o.Total,
        TableId = o.TableId,
        AdresseLivraison = o.Adresse,
        DateCommande = o.DateCommande,
        DateMiseAJour = o.DateMiseAJour,
        Items = o.Lignes.Select(l => new CommandeItem
        {
            ArticleId = l.ArticleId,
            NomFr = l.NomFr,
            PrixUnitaire = l.PrixUnitaire,
            Quantite = l.Quantite
        }).ToList(),
        // Étapes du client attribuées au client ; celles du restaurant sans auteur (aucun compte admin n'est utilisé).
        Historique = o.Historique.Select(h => new HistoriqueStatut
        {
            Statut = h.Statut,
            Date = h.Date,
            ParUserId = h.ParClient ? userId : null
        }).ToList()
    };

    private static async Task<DemoSnapshot> LoadSnapshotAsync(AppDbContext db, DemoFile file, CancellationToken ct)
    {
        var emails = file.Utilisateurs!.Select(u => DemoAccounts.Normalize(u.Email!)).Distinct().ToList();
        var emailSet = emails.ToHashSet();
        var rows = await MatchingUsersQuery(db, emails).ToListAsync(ct);
        var rowIds = rows.Select(r => r.Id).ToList();
        var admins = (await AdminIdsQuery(db, rowIds).ToListAsync(ct)).ToHashSet();
        var users = rows.Select(r => new ExistingUser(
            r.Id, r.Email, r.NormalizedEmail, r.NormalizedUserName, r.PhoneNumber, r.DateCreation, admins.Contains(r.Id))).ToList();

        var demoIds = users.Where(u => !u.IsAdmin && DemoAccounts.IsDemo(u.Email, u.PhoneNumber, emailSet)).Select(u => u.Id).ToList();
        var roleName = db.Roles.AsNoTracking().Select(r => r.NormalizedName);

        return new DemoSnapshot(
            users,
            await db.Articles.AsNoTracking().Include(a => a.Categorie).OrderBy(a => a.Id).ToListAsync(ct),
            await db.Tables.AsNoTracking().OrderBy(t => t.Numero).ToListAsync(ct),
            await db.ParametresRestaurant.AsNoTracking().FirstOrDefaultAsync(ct),
            await roleName.AnyAsync(n => n == Roles.Client.ToUpperInvariant(), ct),
            await db.Adresses.AsNoTracking().Where(a => demoIds.Contains(a.UserId)).OrderBy(a => a.Id).ToListAsync(ct),
            await db.Favoris.AsNoTracking().Where(f => demoIds.Contains(f.UserId)).ToListAsync(ct),
            await OrdersOfQuery(db, demoIds).CountAsync(ct));
    }

    // ---------- Reset ----------

    public static async Task<ResetPlan> ResetPlanAsync(AppDbContext db, DemoFile file, CancellationToken ct = default)
    {
        var (accounts, excluded) = await FindDemoAccountsAsync(db, file, ct);
        var ids = accounts.Select(a => a.Id).ToList();
        var orders = OrdersOfQuery(db, ids).AsNoTracking();
        return new ResetPlan(
            accounts, excluded,
            await orders.CountAsync(ct),
            await db.CommandeItems.AsNoTracking().CountAsync(i => orders.Any(c => c.Id == i.CommandeId), ct),
            await db.HistoriqueStatuts.AsNoTracking().CountAsync(h => orders.Any(c => c.Id == h.CommandeId), ct),
            await db.Favoris.AsNoTracking().CountAsync(f => ids.Contains(f.UserId), ct),
            await db.Adresses.AsNoTracking().CountAsync(a => ids.Contains(a.UserId), ct),
            await db.Paniers.AsNoTracking().CountAsync(p => ids.Contains(p.UserId), ct));
    }

    /// <summary>Supprime les comptes de démo et leurs données. Les dépendances sont supprimées explicitement
    /// (EF InMemory n'applique pas les ON DELETE CASCADE de PostgreSQL aux lignes non chargées).</summary>
    public static async Task<ResetPlan> ResetAsync(AppDbContext db, DemoFile file, CancellationToken ct = default)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var plan = await ResetPlanAsync(db, file, ct);
            var ids = plan.Accounts.Select(a => a.Id).ToList();

            db.Commandes.RemoveRange(await OrdersOfQuery(db, ids).Include(c => c.Items).Include(c => c.Historique).AsSplitQuery().ToListAsync(ct));
            db.Paniers.RemoveRange(await db.Paniers.Include(p => p.Items).Where(p => ids.Contains(p.UserId)).ToListAsync(ct));
            db.Favoris.RemoveRange(await db.Favoris.Where(f => ids.Contains(f.UserId)).ToListAsync(ct));
            db.Adresses.RemoveRange(await db.Adresses.Where(a => ids.Contains(a.UserId)).ToListAsync(ct));
            db.UserRoles.RemoveRange(await db.UserRoles.Where(x => ids.Contains(x.UserId)).ToListAsync(ct));
            db.UserClaims.RemoveRange(await db.UserClaims.Where(x => ids.Contains(x.UserId)).ToListAsync(ct));
            db.UserLogins.RemoveRange(await db.UserLogins.Where(x => ids.Contains(x.UserId)).ToListAsync(ct));
            db.UserTokens.RemoveRange(await db.UserTokens.Where(x => ids.Contains(x.UserId)).ToListAsync(ct));
            db.Users.RemoveRange(await db.Users.Where(u => ids.Contains(u.Id)).ToListAsync(ct));

            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return plan;
        });
    }

    private static async Task<(List<ResetAccount> Accounts, List<string> Excluded)> FindDemoAccountsAsync(
        AppDbContext db, DemoFile file, CancellationToken ct)
    {
        var emails = (file.Utilisateurs ?? [])
            .Where(u => !string.IsNullOrWhiteSpace(u.Email))
            .Select(u => DemoAccounts.Normalize(u.Email!))
            .Distinct()
            .ToList();
        var emailSet = emails.ToHashSet();
        var rows = (await MatchingUsersQuery(db, emails).ToListAsync(ct))
            .Where(r => DemoAccounts.IsDemo(r.Email, r.PhoneNumber, emailSet))
            .ToList();
        var admins = (await AdminIdsQuery(db, rows.Select(r => r.Id).ToList()).ToListAsync(ct)).ToHashSet();

        var accounts = rows.Where(r => !admins.Contains(r.Id))
            .OrderBy(r => r.Email, StringComparer.OrdinalIgnoreCase)
            .Select(r => new ResetAccount(r.Id, r.Email!, r.Nom))
            .ToList();
        var excluded = rows.Where(r => admins.Contains(r.Id)).Select(r => $"{r.Email} (rôle Admin, jamais supprimé)").ToList();
        return (accounts, excluded);
    }
}
