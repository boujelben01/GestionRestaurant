namespace Resto.Api.Domain;

public class Commande
{
    public int Id { get; set; }
    public string Numero { get; set; } = string.Empty;
    public string? UserId { get; set; }
    public string NomClient { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public StatutCommande Statut { get; set; } = StatutCommande.EnAttente;
    public TypeCommande TypeCommande { get; set; }
    public ModePaiement ModePaiement { get; set; } = ModePaiement.Especes;
    public bool EstPayee { get; set; }
    public decimal SousTotal { get; set; }
    public decimal FraisLivraison { get; set; }
    public decimal Total { get; set; }
    public int? TableId { get; set; }
    public string? AdresseLivraison { get; set; }
    public string? Note { get; set; }
    public DateTime DateCommande { get; set; }
    public DateTime DateMiseAJour { get; set; }
    public uint Version { get; set; }

    public ApplicationUser? User { get; set; }
    public RestaurantTable? Table { get; set; }
    public List<CommandeItem> Items { get; set; } = [];
    public List<HistoriqueStatut> Historique { get; set; } = [];
}
