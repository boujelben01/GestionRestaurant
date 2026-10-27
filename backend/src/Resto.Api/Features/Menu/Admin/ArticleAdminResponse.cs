namespace Resto.Api.Features.Menu.Admin;

public record ArticleAdminResponse(
    int Id,
    int CategorieId,
    string NomFr,
    string? DescriptionFr,
    decimal Prix,
    string? ImageUrl,
    bool EstDisponible,
    bool EstActif,
    bool EstPopulaire,
    int Ordre,
    DateTime DateCreation,
    DateTime DateMiseAJour);
