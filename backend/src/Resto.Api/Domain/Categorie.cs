namespace Resto.Api.Domain;

public class Categorie
{
    public int Id { get; set; }
    public string NomFr { get; set; } = string.Empty;
    public string NomAr { get; set; } = string.Empty;
    public int Ordre { get; set; }
    public bool EstActive { get; set; } = true;

    public List<Article> Articles { get; set; } = [];
}
