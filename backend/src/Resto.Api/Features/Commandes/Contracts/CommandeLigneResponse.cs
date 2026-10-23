namespace Resto.Api.Features.Commandes.Contracts;

public record CommandeLigneResponse(int? ArticleId, string NomFr, string NomAr, decimal PrixUnitaire, int Quantite, decimal TotalLigne);
