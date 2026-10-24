namespace Resto.Api.Features.Statistiques;

/// <param name="CategorieId">Null pour « Autres » (lignes dont l'article a été supprimé).</param>
public record RepartitionCategorieResponse(int? CategorieId, string Nom, int Quantite, decimal ChiffreAffaires);
