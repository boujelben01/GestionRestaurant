namespace resto.Models
{
    public class Panier
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public DateTime DateCreation { get; set; } = DateTime.UtcNow;
        public DateTime DateMiseAJour { get; set; } = DateTime.UtcNow;
        public ApplicationUser? User { get; set; }
        public List<PanierItem> Items { get; set; } = new();
    }
}
