namespace Resto.Api.Features.Panier.Contracts;

public record PanierLigneResponse(
    int ArticleId,
    string Nom,
    decimal PrixUnitaire,
    string? ImageUrl,
    bool Disponible,
    int Quantite,
    decimal TotalLigne,
    string? Avertissement);
