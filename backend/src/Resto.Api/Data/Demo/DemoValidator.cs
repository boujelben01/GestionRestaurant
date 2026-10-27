using System.Globalization;
using System.Text.RegularExpressions;
using Resto.Api.Domain;
using Resto.Api.Features.Adresses;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Panier;
using Resto.Api.Features.Statistiques;

namespace Resto.Api.Data.Demo;

// Validation du fichier seul (sans base). Les références au catalogue et aux tables, et les conflits de comptes,
// sont vérifiés par DemoPlanner avec l'état réel de la base.
public static partial class DemoValidator
{
    public const int NomMax = 100;
    public const int EmailMax = 256;
    public const int TelephoneMax = 20;
    public const int CommandesParJourMax = 500;
    public const int LignesMax = 20;
    public const int ActivesMax = 50;
    public const int CreeIlYaJoursMax = 3650;

    public static readonly StatutCommande[] StatutsActifs =
        [StatutCommande.EnAttente, StatutCommande.EnPreparation, StatutCommande.Prete];

    public static IReadOnlyList<string> Validate(DemoFile file)
    {
        var errors = new List<string>();
        ValidateReglages(errors, file.Reglages);

        if (file.Utilisateurs is not { Count: > 0 })
        {
            errors.Add("Le fichier doit contenir au moins un utilisateur.");
            return errors;
        }

        var cles = new HashSet<string>(StringComparer.Ordinal);
        var emails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var telephones = new HashSet<string>(StringComparer.Ordinal);
        for (var i = 0; i < file.Utilisateurs.Count; i++)
        {
            ValidateUtilisateur(errors, file.Utilisateurs[i], i, cles, emails, telephones);
        }

        var manuelles = file.CommandesManuelles ?? [];
        for (var i = 0; i < manuelles.Count; i++)
        {
            ValidateManuelle(errors, manuelles[i], i, file);
        }
        return errors;
    }

    // ---------- Réglages ----------

    private static void ValidateReglages(List<string> errors, DemoReglages? r)
    {
        if (r is null)
        {
            errors.Add("« reglages » est absent.");
            return;
        }

        if (r.Graine is null) errors.Add("reglages : « graine » absente.");
        if (r.Jours is null or < 1 || r.Jours > StatsPeriod.MaxDays)
        {
            errors.Add($"reglages : « jours » absent ou hors de 1 à {StatsPeriod.MaxDays}.");
        }
        CheckIntervalle(errors, "commandesParJour", r.CommandesParJour, 0, CommandesParJourMax);
        CheckIntervalle(errors, "lignesParCommande", r.LignesParCommande, 1, LignesMax);
        if (r.QuantiteMax is null or < 1 || r.QuantiteMax > PanierRules.MaxQuantite)
        {
            errors.Add($"reglages : « quantiteMax » absent ou hors de 1 à {PanierRules.MaxQuantite}.");
        }
        if (r.PourcentageAnnulees is null or < 0 or > 100)
        {
            errors.Add("reglages : « pourcentageAnnulees » absent ou hors de 0 à 100.");
        }

        if (r.RepartitionTypes is not { Count: > 0 })
        {
            errors.Add("reglages : « repartitionTypes » absente.");
        }
        else
        {
            foreach (var (key, value) in r.RepartitionTypes)
            {
                if (ParseType(key) is null) errors.Add($"reglages.repartitionTypes : type « {key} » inconnu (SurPlace, ARemporter, Livraison).");
                if (value < 0) errors.Add($"reglages.repartitionTypes : « {key} » négatif.");
            }
            if (r.RepartitionTypes.Values.Where(v => v > 0).Sum() != 100)
            {
                errors.Add("reglages.repartitionTypes : la somme des pourcentages doit valoir 100.");
            }
        }

        if (r.CommandesActivesAujourdhui is null)
        {
            errors.Add("reglages : « commandesActivesAujourdhui » absent.");
        }
        else
        {
            foreach (var (key, value) in r.CommandesActivesAujourdhui)
            {
                if (ParseStatut(key) is not { } statut || !StatutsActifs.Contains(statut))
                {
                    errors.Add($"reglages.commandesActivesAujourdhui : statut « {key} » refusé (EnAttente, EnPreparation, Prete).");
                }
                if (value is < 0 or > ActivesMax)
                {
                    errors.Add($"reglages.commandesActivesAujourdhui : « {key} » hors de 0 à {ActivesMax}.");
                }
            }
        }
    }

    private static void CheckIntervalle(List<string> errors, string key, DemoIntervalle? value, int min, int max)
    {
        if (value?.Min is not { } lo || value.Max is not { } hi)
        {
            errors.Add($"reglages : « {key} » doit avoir « min » et « max ».");
            return;
        }
        if (lo < min || hi > max || lo > hi)
        {
            errors.Add($"reglages : « {key} » incohérent (attendu {min} ≤ min ≤ max ≤ {max}, reçu {lo} à {hi}).");
        }
    }

    // ---------- Utilisateurs ----------

    private static void ValidateUtilisateur(
        List<string> errors, DemoUtilisateur u, int index, HashSet<string> cles, HashSet<string> emails, HashSet<string> telephones)
    {
        var where = $"Utilisateur n°{index + 1}" + (Blank(u.Cle) ? "" : $" « {u.Cle} »");

        if (Blank(u.Cle)) errors.Add($"{where} : « cle » vide ou absente.");
        else if (!cles.Add(u.Cle!.Trim())) errors.Add($"{where} : clé en double.");

        if (Blank(u.Nom) || u.Nom!.Trim().Length > NomMax) errors.Add($"{where} : « nom » vide ou de plus de {NomMax} caractères.");

        if (Blank(u.Email) || u.Email!.Trim().Length > EmailMax || !EmailRegex().IsMatch(u.Email.Trim()))
        {
            errors.Add($"{where} : e-mail vide ou invalide.");
        }
        else if (!emails.Add(u.Email.Trim()))
        {
            errors.Add($"{where} : e-mail « {u.Email.Trim()} » en double.");
        }

        // Le préfixe fait partie du repère des comptes de démo : sans lui, le compte ne serait jamais reconnu (ni supprimé).
        if (Blank(u.Telephone) || u.Telephone!.Trim().Length > TelephoneMax || !u.Telephone.Trim().StartsWith(DemoAccounts.TelephonePrefix, StringComparison.Ordinal))
        {
            errors.Add($"{where} : téléphone vide, trop long ou qui ne commence pas par {DemoAccounts.TelephonePrefix}.");
        }
        else if (!telephones.Add(u.Telephone.Trim()))
        {
            errors.Add($"{where} : téléphone en double.");
        }

        if (u.Actif is null) errors.Add($"{where} : « actif » absent.");
        if (u.CreeIlYaJours is null or < 0 or > CreeIlYaJoursMax) errors.Add($"{where} : « creeIlYaJours » absent ou hors de 0 à {CreeIlYaJoursMax}.");

        ValidateAdresses(errors, where, u.Adresses);
        ValidateFavoris(errors, where, u.Favoris);
    }

    private static void ValidateAdresses(List<string> errors, string where, List<DemoAdresse>? adresses)
    {
        if (adresses is null) return;
        if (adresses.Count > AdresseRules.MaxParUtilisateur)
        {
            errors.Add($"{where} : plus de {AdresseRules.MaxParUtilisateur} adresses.");
        }
        if (adresses.Count > 0 && adresses.Count(a => a.ParDefaut == true) != 1)
        {
            errors.Add($"{where} : il faut exactement une adresse « parDefaut ».");
        }

        var libelles = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < adresses.Count; i++)
        {
            var a = adresses[i];
            var at = $"{where}, adresse n°{i + 1}";
            if (Blank(a.Libelle) || a.Libelle!.Trim().Length > AdresseRules.LibelleMax) errors.Add($"{at} : libellé vide ou trop long.");
            else if (!libelles.Add(a.Libelle.Trim())) errors.Add($"{at} : libellé « {a.Libelle.Trim()} » en double.");
            if (Blank(a.Ligne) || a.Ligne!.Trim().Length > AdresseRules.LigneMax) errors.Add($"{at} : « ligne » vide ou trop longue.");
            if (Blank(a.Ville) || a.Ville!.Trim().Length > AdresseRules.VilleMax) errors.Add($"{at} : « ville » vide ou trop longue.");
            if (a.Details is not null && a.Details.Trim().Length > AdresseRules.DetailsMax) errors.Add($"{at} : « details » trop long.");
            if (a.Telephone is not null && (Blank(a.Telephone) || a.Telephone.Trim().Length > AdresseRules.TelephoneMax))
            {
                errors.Add($"{at} : « telephone » vide ou trop long (null pour reprendre celui du compte).");
            }
            if (a.ParDefaut is null) errors.Add($"{at} : « parDefaut » absent.");

            var texte = DeliveryLine(a);
            if (texte.Length is < CommandeRules.AdresseMin or > CommandeRules.AdresseMax)
            {
                errors.Add($"{at} : adresse de livraison de {CommandeRules.AdresseMin} à {CommandeRules.AdresseMax} caractères attendue.");
            }
        }
    }

    private static void ValidateFavoris(List<string> errors, string where, List<DemoReference>? favoris)
    {
        if (favoris is null) return;
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < favoris.Count; i++)
        {
            var f = favoris[i];
            if (Blank(f.Categorie) || Blank(f.Article))
            {
                errors.Add($"{where}, favori n°{i + 1} : « categorie » et « article » obligatoires.");
            }
            else if (!seen.Add(Key(f.Categorie, f.Article)))
            {
                errors.Add($"{where}, favori n°{i + 1} : « {f.Categorie!.Trim()} > {f.Article!.Trim()} » en double.");
            }
        }
    }

    // ---------- Commandes manuelles ----------

    private static void ValidateManuelle(List<string> errors, DemoCommandeManuelle c, int index, DemoFile file)
    {
        var where = $"Commande manuelle n°{index + 1}";
        var user = file.Utilisateurs!.FirstOrDefault(u => string.Equals(u.Cle?.Trim(), c.Utilisateur?.Trim(), StringComparison.Ordinal));
        if (Blank(c.Utilisateur) || user is null)
        {
            errors.Add($"{where} : utilisateur « {c.Utilisateur} » inconnu.");
        }
        else if (user.Actif == false)
        {
            errors.Add($"{where} : l'utilisateur « {c.Utilisateur} » est inactif (un compte désactivé ne commande pas).");
        }

        var type = ParseType(c.Type);
        var statut = ParseStatut(c.Statut);
        if (type is null) errors.Add($"{where} : type « {c.Type} » inconnu (SurPlace, ARemporter, Livraison).");
        if (statut is null) errors.Add($"{where} : statut « {c.Statut} » inconnu.");
        if (c.Paye is null) errors.Add($"{where} : « paye » absent.");
        if (ParseHeure(c.Heure) is null) errors.Add($"{where} : heure « {c.Heure} » invalide (HH:mm, heure de Tunis).");

        if (c.IlYaJours is not { } jours || jours < 0)
        {
            errors.Add($"{where} : « ilYaJours » absent ou négatif.");
        }
        else
        {
            if (file.Reglages?.Jours is { } max && jours >= max)
            {
                errors.Add($"{where} : « ilYaJours » doit être inférieur à reglages.jours ({max}).");
            }
            if (user?.CreeIlYaJours is { } cree && jours >= cree)
            {
                errors.Add($"{where} : commande antérieure (ou du même jour) à la création du compte « {c.Utilisateur} ».");
            }
            if (statut is { } s)
            {
                var actif = StatutsActifs.Contains(s);
                if (actif && jours != 0) errors.Add($"{where} : une commande {s} ne peut être qu'aujourd'hui (ilYaJours = 0).");
                if (!actif && jours == 0) errors.Add($"{where} : une commande {s} doit être passée (ilYaJours ≥ 1).");
            }
        }

        if (statut == StatutCommande.Annulee && c.Paye == true)
        {
            errors.Add($"{where} : une commande annulée ne peut pas être payée.");
        }

        switch (type)
        {
            case TypeCommande.SurPlace:
                if (c.Table is null or < 1) errors.Add($"{where} : « table » obligatoire pour une commande sur place.");
                if (c.Adresse is not null) errors.Add($"{where} : « adresse » refusée pour une commande sur place.");
                break;
            case TypeCommande.Livraison:
                if (c.Table is not null) errors.Add($"{where} : « table » refusée pour une livraison.");
                if (Blank(c.Adresse)) errors.Add($"{where} : « adresse » (libellé d'une adresse du client) obligatoire pour une livraison.");
                else if (user is not null && !(user.Adresses ?? []).Any(a => string.Equals(a.Libelle?.Trim(), c.Adresse!.Trim(), StringComparison.OrdinalIgnoreCase)))
                {
                    errors.Add($"{where} : adresse « {c.Adresse} » introuvable pour « {c.Utilisateur} ».");
                }
                break;
            case TypeCommande.ARemporter:
                if (c.Table is not null || c.Adresse is not null) errors.Add($"{where} : ni « table » ni « adresse » pour une commande à emporter.");
                break;
        }

        if (c.Lignes is not { Count: > 0 } || c.Lignes.Count > LignesMax)
        {
            errors.Add($"{where} : de 1 à {LignesMax} lignes attendues.");
            return;
        }
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < c.Lignes.Count; i++)
        {
            var l = c.Lignes[i];
            var at = $"{where}, ligne n°{i + 1}";
            if (Blank(l.Categorie) || Blank(l.Article)) errors.Add($"{at} : « categorie » et « article » obligatoires.");
            else if (!seen.Add(Key(l.Categorie, l.Article))) errors.Add($"{at} : article en double dans la commande.");
            if (l.Quantite is null or < 1 || l.Quantite > PanierRules.MaxQuantite) errors.Add($"{at} : quantité absente ou hors de 1 à {PanierRules.MaxQuantite}.");
        }
    }

    // ---------- Aides partagées ----------

    public static TypeCommande? ParseType(string? value) =>
        value is not null && Enum.GetNames<TypeCommande>().Contains(value.Trim(), StringComparer.Ordinal)
            ? Enum.Parse<TypeCommande>(value.Trim())
            : null;

    public static StatutCommande? ParseStatut(string? value) =>
        value is not null && Enum.GetNames<StatutCommande>().Contains(value.Trim(), StringComparer.Ordinal)
            ? Enum.Parse<StatutCommande>(value.Trim())
            : null;

    public static TimeOnly? ParseHeure(string? value) =>
        value is not null && TimeOnly.TryParseExact(value.Trim(), "HH:mm", CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            ? t
            : null;

    /// <summary>Même texte que le front (deliveryLine) : « ligne, ville, détails ».</summary>
    public static string DeliveryLine(DemoAdresse a) =>
        string.Join(", ", new[] { a.Ligne, a.Ville, a.Details }.Select(p => p?.Trim()).Where(p => !string.IsNullOrEmpty(p)));

    public static string Key(string? categorie, string? article) => $"{categorie?.Trim()}\u001f{article?.Trim()}".ToUpperInvariant();

    private static bool Blank(string? value) => string.IsNullOrWhiteSpace(value);

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();
}
