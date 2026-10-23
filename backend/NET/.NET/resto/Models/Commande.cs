namespace resto.Models
{
    public class Commande
    {
        public int Id { get; set; }
        public string? UserId { get; set; }
        public string NomClient { get; set; } = string.Empty;
        public StatutCommande Statut { get; set; } = StatutCommande.EnAttente;
        public TypeCommande TypeCommande { get; set; }
        public decimal Total { get; set; }
        public DateTime DateCommande { get; set; } = DateTime.UtcNow;
        public string? Note { get; set; }
        public ApplicationUser? User { get; set; }
        public List<CommandeItem> Items { get; set; } = new();
    }
}
