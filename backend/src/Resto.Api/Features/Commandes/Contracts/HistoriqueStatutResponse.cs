using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Contracts;

public record HistoriqueStatutResponse(StatutCommande Statut, DateTime Date);
