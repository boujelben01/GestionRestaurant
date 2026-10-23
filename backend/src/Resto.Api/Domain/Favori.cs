namespace Resto.Api.Domain;

public class Favori
{
    public string UserId { get; set; } = string.Empty;
    public int ArticleId { get; set; }

    public ApplicationUser User { get; set; } = null!;
    public Article Article { get; set; } = null!;
}
