namespace Resto.Api.Features.Panier.Contracts;

public record PanierResponse(
    IReadOnlyList<PanierLigneResponse> Lignes,
    int NombreArticles,
    decimal SousTotal,
    DateTime? DateMiseAJour);
