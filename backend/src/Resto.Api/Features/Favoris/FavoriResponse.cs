namespace Resto.Api.Features.Favoris;

/// <param name="Actif">Faux si l'article (ou sa catégorie) a été désactivé : il reste listé mais ne peut plus être commandé.</param>
public record FavoriResponse(
    int Id,
    int CategorieId,
    string Nom,
    string? Description,
    decimal Prix,
    string? ImageUrl,
    bool EstPopulaire,
    bool Disponible,
    bool Actif);
