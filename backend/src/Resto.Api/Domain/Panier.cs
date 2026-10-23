namespace Resto.Api.Domain;

public class Panier
{
    public int Id { get; set; }
    public string UserId { get; set; } = string.Empty;
    public DateTime DateMiseAJour { get; set; }

    public ApplicationUser User { get; set; } = null!;
    public List<PanierItem> Items { get; set; } = [];
}
