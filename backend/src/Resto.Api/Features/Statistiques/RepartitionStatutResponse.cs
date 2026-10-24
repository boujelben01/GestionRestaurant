using Resto.Api.Domain;

namespace Resto.Api.Features.Statistiques;

/// <summary>Les commandes annulées ont un chiffre d'affaires de 0 par définition.</summary>
public record RepartitionStatutResponse(StatutCommande Statut, int Commandes, decimal ChiffreAffaires);
