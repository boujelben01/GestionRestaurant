namespace Resto.Api.Features.Restaurant.Contracts;

public record RestaurantResponse(
    string Nom,
    string Telephone,
    string Email,
    string Adresse,
    decimal FraisLivraison,
    decimal MontantMinimumLivraison,
    bool CommandesOuvertes,
    IReadOnlyList<HoraireResponse> Horaires,
    bool OuvertMaintenant);
