namespace resto.Models
{
    public class Article
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public string? Description { get; set; }
        public decimal Prix { get; set; }
        public string? ImageUrl { get; set; }
        public bool EstDisponible { get; set; } = true;
        public int Ordre { get; set; }
        public int CategorieId { get; set; }
        public Categorie? Categorie { get; set; }
    }
}
