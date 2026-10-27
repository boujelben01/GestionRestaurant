using System.Globalization;
using Resto.Api.Domain;

namespace Resto.Api.Data.Catalogue;

public enum ChangeType { Create, Update, Unchanged, Missing, Deactivate }

// Apply est null pour Unchanged et Missing. Il n'est exécuté que par CatalogueSync.ApplyAsync.
public sealed record PlannedChange(string Entity, ChangeType Type, string Name, string Detail, Action<AppDbContext>? Apply);

public sealed record CataloguePlan(IReadOnlyList<PlannedChange> Changes)
{
    public int Count(ChangeType type) => Changes.Count(c => c.Type == type);
}

// Calcule ce qu'il faudrait écrire, sans rien écrire : les modifications sont des closures exécutées plus tard.
// Une catégorie se retrouve par NomFr, un article par (catégorie, NomFr), sans tenir compte de la casse.
public static class CataloguePlanner
{
    private static readonly StringComparison Cmp = StringComparison.OrdinalIgnoreCase;

    public static CataloguePlan Plan(
        CatalogueFile file, IReadOnlyCollection<Categorie> existing, bool deactivateMissing, DateTime now)
    {
        var changes = new List<PlannedChange>();
        var matched = new HashSet<Categorie>();

        foreach (var wanted in file.Categories!)
        {
            var nomFr = wanted.NomFr!.Trim();
            var current = existing.FirstOrDefault(c => string.Equals(c.NomFr, nomFr, Cmp));
            if (current is null)
            {
                PlanNewCategorie(changes, wanted, now);
                continue;
            }

            matched.Add(current);
            PlanCategorie(changes, current, wanted);
            PlanArticles(changes, current, wanted, deactivateMissing, now);
        }

        foreach (var absent in existing.Where(c => !matched.Contains(c)))
        {
            PlanMissingCategorie(changes, absent, deactivateMissing, now);
        }
        return new CataloguePlan(changes);
    }

    private static void PlanNewCategorie(List<PlannedChange> changes, CatalogueCategorie wanted, DateTime now)
    {
        var categorie = new Categorie
        {
            NomFr = wanted.NomFr!.Trim(),
            NomAr = wanted.NomAr!.Trim(),
            Ordre = wanted.Ordre!.Value,
            EstActive = true
        };
        changes.Add(new("Catégorie", ChangeType.Create, categorie.NomFr, $"ordre {categorie.Ordre}", db => db.Categories.Add(categorie)));
        foreach (var article in wanted.Articles!)
        {
            var created = NewArticle(categorie, article, now);
            changes.Add(new("Article", ChangeType.Create, $"{categorie.NomFr} > {created.NomFr}", Describe(created), db => db.Articles.Add(created)));
        }
    }

    private static void PlanCategorie(List<PlannedChange> changes, Categorie current, CatalogueCategorie wanted)
    {
        var nomAr = wanted.NomAr!.Trim();
        var ordre = wanted.Ordre!.Value;
        var diffs = new List<string>();
        Diff(diffs, "nomAr", current.NomAr, nomAr);
        Diff(diffs, "ordre", current.Ordre, ordre);
        if (!current.EstActive) diffs.Add("réactivée");

        if (diffs.Count == 0)
        {
            changes.Add(new("Catégorie", ChangeType.Unchanged, current.NomFr, "", null));
            return;
        }
        changes.Add(new("Catégorie", ChangeType.Update, current.NomFr, string.Join(", ", diffs), _ =>
        {
            current.NomAr = nomAr;
            current.Ordre = ordre;
            current.EstActive = true;
        }));
    }

    private static void PlanArticles(
        List<PlannedChange> changes, Categorie current, CatalogueCategorie wanted, bool deactivateMissing, DateTime now)
    {
        var matched = new HashSet<Article>();
        foreach (var article in wanted.Articles!)
        {
            var nomFr = article.NomFr!.Trim();
            var name = $"{current.NomFr} > {nomFr}";
            var existing = current.Articles.FirstOrDefault(a => string.Equals(a.NomFr, nomFr, Cmp));
            if (existing is null)
            {
                var created = NewArticle(current, article, now);
                changes.Add(new("Article", ChangeType.Create, name, Describe(created), db => db.Articles.Add(created)));
                continue;
            }

            matched.Add(existing);
            var diffs = new List<string>();
            Diff(diffs, "nomAr", existing.NomAr, article.NomAr!.Trim());
            Diff(diffs, "descriptionFr", existing.DescriptionFr, article.DescriptionFr);
            Diff(diffs, "descriptionAr", existing.DescriptionAr, article.DescriptionAr);
            Diff(diffs, "prix", existing.Prix, article.Prix!.Value);
            Diff(diffs, "populaire", existing.EstPopulaire, article.Populaire!.Value);
            Diff(diffs, "disponible", existing.EstDisponible, article.Disponible!.Value);
            Diff(diffs, "image", existing.ImageUrl, article.Image);
            Diff(diffs, "ordre", existing.Ordre, article.Ordre!.Value);
            if (!existing.EstActif) diffs.Add("réactivé");

            if (diffs.Count == 0)
            {
                changes.Add(new("Article", ChangeType.Unchanged, name, "", null));
                continue;
            }
            changes.Add(new("Article", ChangeType.Update, name, string.Join(", ", diffs), _ =>
            {
                existing.NomAr = article.NomAr!.Trim();
                existing.DescriptionFr = article.DescriptionFr;
                existing.DescriptionAr = article.DescriptionAr;
                existing.Prix = article.Prix!.Value;
                existing.EstPopulaire = article.Populaire!.Value;
                existing.EstDisponible = article.Disponible!.Value;
                existing.ImageUrl = article.Image;
                existing.Ordre = article.Ordre!.Value;
                existing.EstActif = true;
                existing.DateMiseAJour = now;
            }));
        }

        foreach (var absent in current.Articles.Where(a => !matched.Contains(a)))
        {
            PlanMissingArticle(changes, current, absent, deactivateMissing, now);
        }
    }

    // Une catégorie absente du fichier entraîne ses articles : l'administration refuse de désactiver
    // une catégorie qui contient encore des articles actifs, on garde la même cohérence.
    private static void PlanMissingCategorie(List<PlannedChange> changes, Categorie absent, bool deactivate, DateTime now)
    {
        foreach (var article in absent.Articles)
        {
            PlanMissingArticle(changes, absent, article, deactivate, now);
        }

        if (deactivate && absent.EstActive)
        {
            changes.Add(new("Catégorie", ChangeType.Deactivate, absent.NomFr, "absente du fichier", _ => absent.EstActive = false));
            return;
        }
        changes.Add(new("Catégorie", ChangeType.Missing, absent.NomFr,
            absent.EstActive ? "absente du fichier, reste active" : "absente du fichier, déjà inactive", null));
    }

    private static void PlanMissingArticle(
        List<PlannedChange> changes, Categorie categorie, Article absent, bool deactivate, DateTime now)
    {
        var name = $"{categorie.NomFr} > {absent.NomFr}";
        if (deactivate && absent.EstActif)
        {
            changes.Add(new("Article", ChangeType.Deactivate, name, "absent du fichier", _ =>
            {
                absent.EstActif = false;
                absent.DateMiseAJour = now;
            }));
            return;
        }
        changes.Add(new("Article", ChangeType.Missing, name,
            absent.EstActif ? "absent du fichier, reste actif" : "absent du fichier, déjà inactif", null));
    }

    private static Article NewArticle(Categorie categorie, CatalogueArticle a, DateTime now) => new()
    {
        Categorie = categorie,
        NomFr = a.NomFr!.Trim(),
        NomAr = a.NomAr!.Trim(),
        DescriptionFr = a.DescriptionFr,
        DescriptionAr = a.DescriptionAr,
        Prix = a.Prix!.Value,
        ImageUrl = a.Image,
        EstPopulaire = a.Populaire!.Value,
        EstDisponible = a.Disponible!.Value,
        EstActif = true,
        Ordre = a.Ordre!.Value,
        DateCreation = now,
        DateMiseAJour = now
    };

    private static string Describe(Article a) =>
        string.Create(CultureInfo.InvariantCulture, $"prix {a.Prix}, ordre {a.Ordre}, image {a.ImageUrl ?? "aucune"}");

    private static void Diff<T>(List<string> diffs, string field, T before, T after)
    {
        if (!EqualityComparer<T>.Default.Equals(before, after))
        {
            diffs.Add(string.Create(CultureInfo.InvariantCulture, $"{field} : {before?.ToString() ?? "∅"} → {after?.ToString() ?? "∅"}"));
        }
    }
}
