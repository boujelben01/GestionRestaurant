namespace Resto.Api.Domain;

public class Article
{
    public int Id { get; set; }
    public int CategorieId { get; set; }
    public string NomFr { get; set; } = string.Empty;
    public string NomAr { get; set; } = string.Empty;
    public string? DescriptionFr { get; set; }
    public string? DescriptionAr { get; set; }
    public decimal Prix { get; set; }
    public string? ImageUrl { get; set; }
    public bool EstDisponible { get; set; } = true;
    public bool EstActif { get; set; } = true;
    public bool EstPopulaire { get; set; }
    public int Ordre { get; set; }
    public DateTime DateCreation { get; set; }
    public DateTime DateMiseAJour { get; set; }

    public Categorie Categorie { get; set; } = null!;
}
