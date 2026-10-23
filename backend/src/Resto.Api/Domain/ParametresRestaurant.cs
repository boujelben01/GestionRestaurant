namespace Resto.Api.Domain;

public class ParametresRestaurant
{
    public int Id { get; set; } = 1;
    public string Nom { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Adresse { get; set; } = string.Empty;
    public decimal FraisLivraison { get; set; }
    public decimal MontantMinimumLivraison { get; set; }
    public bool CommandesOuvertes { get; set; } = true;
}
