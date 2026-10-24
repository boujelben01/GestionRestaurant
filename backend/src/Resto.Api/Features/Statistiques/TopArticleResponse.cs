namespace Resto.Api.Features.Statistiques;

public record TopArticleResponse(int? ArticleId, string Nom, int Quantite, decimal ChiffreAffaires);
