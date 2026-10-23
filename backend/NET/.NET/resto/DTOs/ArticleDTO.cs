namespace resto.DTOs
{
    public class ArticleDTO
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public decimal Prix { get; set; }
        public int CategorieId { get; set; }
        public string? Description { get; set; }
    }
}
