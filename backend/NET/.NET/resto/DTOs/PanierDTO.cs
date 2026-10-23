namespace resto.DTO
{
    public class PanierDTO
    {
        public int Id { get; set; }
        public string UserId { get; set; } = string.Empty;
        public List<PanierItemDto> Items { get; set; } = new();
    }

    public class PanierItemDto
    {
        public int ArticleId { get; set; }
        public int Quantity { get; set; }
        public decimal PrixUnitaire { get; set; }
    }
}
