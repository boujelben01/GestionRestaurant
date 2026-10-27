namespace Resto.Api.Features.Commandes.Admin;

public record CommandeAdminLigneResponse(int? ArticleId, string NomFr, decimal PrixUnitaire, int Quantite, decimal TotalLigne);
