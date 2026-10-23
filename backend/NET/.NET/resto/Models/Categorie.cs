namespace resto.Models
{
    public class Categorie
    {
        public int Id { get; set; }
        public string Nom { get; set; } = string.Empty;
        public int Ordre { get; set; }
        public bool EstActive { get; set; } = true;
        public ICollection<Article> Articles { get; set; } = new List<Article>();
    }
}
