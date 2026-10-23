namespace resto.DTO
{
    public class CommandeDto
    {
        public int Id { get; set; }
        public string? ClientId { get; set; }
        public string Username { get; set; } = string.Empty;
        public decimal Total { get; set; }
        public DateTime OrderDate { get; set; }
        public List<CommandeItemDto> Items { get; set; } = new();
    }

    public class CommandeItemDto
    {
        public int? ArticleId { get; set; }
        public string ArticleName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal PrixUnitaire { get; set; }
    }
}
