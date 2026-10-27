using Resto.Api.Common.Validation;

namespace Resto.Api.Data.Catalogue;

// Les limites reprennent celles de CategorieRequest et ArticleRequest (administration du menu).
public static class CatalogueValidator
{
    public const int CategorieNomMax = 100;
    public const int ArticleNomMax = 150;
    public const int DescriptionMax = 1000;
    public const decimal PrixMax = 99999999.99m;
    public const int OrdreMax = 10000;

    public static IReadOnlyList<string> Validate(CatalogueFile file)
    {
        var errors = new List<string>();
        if (file.Categories is not { Count: > 0 })
        {
            errors.Add("Le fichier doit contenir au moins une catégorie.");
            return errors;
        }

        var categorieNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < file.Categories.Count; i++)
        {
            var categorie = file.Categories[i];
            var where = $"Catégorie n°{i + 1}" + (Blank(categorie.NomFr) ? "" : $" « {categorie.NomFr!.Trim()} »");

            CheckName(errors, where, "nomFr", categorie.NomFr, CategorieNomMax, categorieNames);
            CheckName(errors, where, "nomAr", categorie.NomAr, CategorieNomMax, null);
            CheckOrdre(errors, where, categorie.Ordre);

            if (categorie.Articles is null)
            {
                errors.Add($"{where} : la liste « articles » est absente.");
                continue;
            }

            var articleNames = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            for (var j = 0; j < categorie.Articles.Count; j++)
            {
                var article = categorie.Articles[j];
                var at = $"{where}, article n°{j + 1}" + (Blank(article.NomFr) ? "" : $" « {article.NomFr!.Trim()} »");
                CheckArticle(errors, at, article, articleNames);
            }
        }
        return errors;
    }

    private static void CheckArticle(List<string> errors, string where, CatalogueArticle article, HashSet<string> names)
    {
        CheckName(errors, where, "nomFr", article.NomFr, ArticleNomMax, names);
        CheckName(errors, where, "nomAr", article.NomAr, ArticleNomMax, null);
        CheckOrdre(errors, where, article.Ordre);

        if (article.Prix is not { } prix)
        {
            errors.Add($"{where} : prix absent.");
        }
        else if (prix < 0 || prix > PrixMax)
        {
            errors.Add($"{where} : prix {prix} hors limites (0 à {PrixMax}).");
        }
        else if (decimal.Round(prix, 2) != prix)
        {
            errors.Add($"{where} : prix {prix} avec plus de 2 décimales.");
        }

        if (article.Populaire is null) errors.Add($"{where} : « populaire » absent.");
        if (article.Disponible is null) errors.Add($"{where} : « disponible » absent.");

        foreach (var (key, value) in new[] { ("descriptionFr", article.DescriptionFr), ("descriptionAr", article.DescriptionAr) })
        {
            if (value is not null && value.Length > DescriptionMax)
            {
                errors.Add($"{where} : {key} dépasse {DescriptionMax} caractères.");
            }
        }

        if (article.Image is not null && !ImageUrlRules.IsValid(article.Image))
        {
            errors.Add($"{where} : image « {article.Image} » refusée (chemin /images/... ou URL https attendus).");
        }
    }

    private static void CheckName(List<string> errors, string where, string key, string? value, int max, HashSet<string>? seen)
    {
        if (Blank(value))
        {
            errors.Add($"{where} : {key} vide ou absent.");
            return;
        }
        var name = value!.Trim();
        if (name.Length > max)
        {
            errors.Add($"{where} : {key} dépasse {max} caractères.");
        }
        if (seen is not null && !seen.Add(name))
        {
            errors.Add($"{where} : {key} « {name} » en double.");
        }
    }

    private static void CheckOrdre(List<string> errors, string where, int? ordre)
    {
        if (ordre is null or < 0 or > OrdreMax)
        {
            errors.Add($"{where} : ordre absent ou hors de 0 à {OrdreMax}.");
        }
    }

    private static bool Blank(string? value) => string.IsNullOrWhiteSpace(value);
}
