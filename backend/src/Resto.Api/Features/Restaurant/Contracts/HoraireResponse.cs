namespace Resto.Api.Features.Restaurant.Contracts;

public record HoraireResponse(int JourSemaine, string? Ouverture, string? Fermeture, bool EstFerme);
