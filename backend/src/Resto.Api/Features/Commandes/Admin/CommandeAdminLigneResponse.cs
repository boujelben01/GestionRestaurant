namespace Resto.Api.Features.Commandes.Admin;

public record CommandeAdminLigneResponse(int? ArticleId, string NomFr, string NomAr, decimal PrixUnitaire, int Quantite, decimal TotalLigne);
