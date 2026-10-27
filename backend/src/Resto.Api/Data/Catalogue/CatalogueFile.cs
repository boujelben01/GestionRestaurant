using System.Text.Json;

namespace Resto.Api.Data.Catalogue;

// Format de Data/catalogue.json, source unique du catalogue. Les champs obligatoires sont nullables ici
// pour que la validation signale un champ absent au lieu de le remplacer par une valeur par défaut.
public sealed class CatalogueFile
{
    public List<CatalogueCategorie>? Categories { get; init; }
}

public sealed class CatalogueCategorie
{
    public string? NomFr { get; init; }
    public string? NomAr { get; init; }
    public int? Ordre { get; init; }
    public List<CatalogueArticle>? Articles { get; init; }
}

public sealed class CatalogueArticle
{
    public int? Ordre { get; init; }
    public string? NomFr { get; init; }
    public string? NomAr { get; init; }
    public string? DescriptionFr { get; init; }
    public string? DescriptionAr { get; init; }
    public decimal? Prix { get; init; }
    public bool? Populaire { get; init; }
    public bool? Disponible { get; init; }
    public string? Image { get; init; }
}

public sealed class CatalogueException(string message) : Exception(message);

public static class CatalogueReader
{
    public const string RelativePath = "Data/catalogue.json";

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public static string DefaultPath => Path.Combine(AppContext.BaseDirectory, RelativePath);

    public static CatalogueFile Read(string path)
    {
        if (!File.Exists(path))
        {
            throw new CatalogueException($"Fichier introuvable : {path}");
        }
        return Parse(File.ReadAllText(path));
    }

    public static CatalogueFile Parse(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<CatalogueFile>(json, Options)
                ?? throw new CatalogueException("Le fichier du catalogue est vide.");
        }
        catch (JsonException ex)
        {
            throw new CatalogueException($"JSON invalide : {ex.Message}");
        }
    }
}
