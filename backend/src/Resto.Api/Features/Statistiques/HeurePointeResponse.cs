namespace Resto.Api.Features.Statistiques;

/// <param name="Heure">Heure locale Africa/Tunis (0 à 23).</param>
public record HeurePointeResponse(int Heure, int Commandes, decimal ChiffreAffaires);
