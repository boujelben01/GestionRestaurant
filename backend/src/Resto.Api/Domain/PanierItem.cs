namespace Resto.Api.Domain;

public class PanierItem
{
    public int Id { get; set; }
    public int PanierId { get; set; }
    public int ArticleId { get; set; }
    public int Quantite { get; set; }

    public Panier Panier { get; set; } = null!;
    public Article Article { get; set; } = null!;
}
