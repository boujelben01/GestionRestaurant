using System.Text.Json;

namespace Resto.Api.Data.Demo;

// Format de Data/demo.json (données de démonstration). Comme pour catalogue.json, les champs obligatoires sont
// nullables pour que la validation signale un champ absent. Aucun prix, aucun identifiant, aucun mot de passe :
// les articles sont retrouvés par (catégorie, NomFr), les tables par numéro, le mot de passe vient de Seed:DemoPassword.
public sealed class DemoFile
{
    public DemoReglages? Reglages { get; init; }
    public List<DemoUtilisateur>? Utilisateurs { get; init; }
    public List<DemoCommandeManuelle>? CommandesManuelles { get; init; }
}

public sealed class DemoReglages
{
    public long? Graine { get; init; }
    public int? Jours { get; init; }
    public DemoIntervalle? CommandesParJour { get; init; }
    public Dictionary<string, int>? RepartitionTypes { get; init; }
    public int? PourcentageAnnulees { get; init; }
    public DemoIntervalle? LignesParCommande { get; init; }
    public int? QuantiteMax { get; init; }
    public Dictionary<string, int>? CommandesActivesAujourdhui { get; init; }
}

public sealed class DemoIntervalle
{
    public int? Min { get; init; }
    public int? Max { get; init; }
}

public sealed class DemoUtilisateur
{
    public string? Cle { get; init; }
    public string? Nom { get; init; }
    public string? Email { get; init; }
    public string? Telephone { get; init; }
    public bool? Actif { get; init; }
    public int? CreeIlYaJours { get; init; }
    public List<DemoAdresse>? Adresses { get; init; }
    public List<DemoReference>? Favoris { get; init; }
}

public sealed class DemoAdresse
{
    public string? Libelle { get; init; }
    public string? Ligne { get; init; }
    public string? Ville { get; init; }
    public string? Details { get; init; }
    public string? Telephone { get; init; }
    public bool? ParDefaut { get; init; }
}

public sealed class DemoReference
{
    public string? Categorie { get; init; }
    public string? Article { get; init; }
}

public sealed class DemoCommandeManuelle
{
    public string? Utilisateur { get; init; }
    public string? Type { get; init; }
    public int? Table { get; init; }
    public string? Adresse { get; init; }
    public int? IlYaJours { get; init; }
    public string? Heure { get; init; }
    public string? Statut { get; init; }
    public bool? Paye { get; init; }
    public List<DemoLigne>? Lignes { get; init; }
}

public sealed class DemoLigne
{
    public string? Categorie { get; init; }
    public string? Article { get; init; }
    public int? Quantite { get; init; }
}

public sealed class DemoException(string message) : Exception(message);

public static class DemoReader
{
    public const string RelativePath = "Data/demo.json";

    private static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        ReadCommentHandling = JsonCommentHandling.Skip,
        AllowTrailingCommas = true
    };

    public static string DefaultPath => Path.Combine(AppContext.BaseDirectory, RelativePath);

    public static DemoFile Read(string path)
    {
        if (!File.Exists(path))
        {
            throw new DemoException($"Fichier introuvable : {path}");
        }
        return Parse(File.ReadAllText(path));
    }

    public static DemoFile Parse(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<DemoFile>(json, Options)
                ?? throw new DemoException("Le fichier de démonstration est vide.");
        }
        catch (JsonException ex)
        {
            throw new DemoException($"JSON invalide : {ex.Message}");
        }
    }
}
