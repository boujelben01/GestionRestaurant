namespace Resto.Api.Domain;

public class HistoriqueStatut
{
    public int Id { get; set; }
    public int CommandeId { get; set; }
    public StatutCommande Statut { get; set; }
    public DateTime Date { get; set; }
    public string? ParUserId { get; set; }

    public Commande Commande { get; set; } = null!;
    public ApplicationUser? ParUser { get; set; }
}
