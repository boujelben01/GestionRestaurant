namespace Resto.Api.Domain;

public class Adresse
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public string Libelle { get; set; } = string.Empty;
    public string Ligne { get; set; } = string.Empty;
    public string Ville { get; set; } = string.Empty;
    public string? Details { get; set; }
    public string Telephone { get; set; } = string.Empty;
    public bool EstParDefaut { get; set; }

    public ApplicationUser User { get; set; } = null!;
}
