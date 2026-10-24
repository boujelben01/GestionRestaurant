using Resto.Api.Domain;

namespace Resto.Api.Features.Statistiques;

public record RepartitionTypeResponse(TypeCommande Type, int Commandes, decimal ChiffreAffaires);
