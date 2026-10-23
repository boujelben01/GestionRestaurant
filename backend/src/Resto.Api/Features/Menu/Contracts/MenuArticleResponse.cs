namespace Resto.Api.Features.Menu.Contracts;

public record MenuArticleResponse(
    int Id,
    int CategorieId,
    string Nom,
    string? Description,
    decimal Prix,
    string? ImageUrl,
    bool EstPopulaire,
    bool Disponible);
