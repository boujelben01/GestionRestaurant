namespace Resto.Api.Features.Statistiques;

public record VenteJourResponse(DateOnly Date, decimal ChiffreAffaires, int Commandes);
