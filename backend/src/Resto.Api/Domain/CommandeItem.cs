namespace Resto.Api.Domain;

public class CommandeItem
{
    public int Id { get; set; }
    public int CommandeId { get; set; }
    public int? ArticleId { get; set; }
    public string NomFr { get; set; } = string.Empty;
    public string NomAr { get; set; } = string.Empty;
    public decimal PrixUnitaire { get; set; }
    public int Quantite { get; set; }

    public Commande Commande { get; set; } = null!;
    public Article? Article { get; set; }
}
