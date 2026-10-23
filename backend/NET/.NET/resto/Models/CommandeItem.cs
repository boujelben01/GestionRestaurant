namespace resto.Models
{
    public class CommandeItem
    {
        public int Id { get; set; }
        public int CommandeId { get; set; }
        public int? ArticleId { get; set; }
        public string NomArticle { get; set; } = string.Empty;
        public decimal PrixUnitaire { get; set; }
        public int Quantite { get; set; }
        public Commande? Commande { get; set; }
        public Article? Article { get; set; }
    }
}
