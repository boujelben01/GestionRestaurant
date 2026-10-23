using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Admin;

public record CompteurStatutResponse(StatutCommande Statut, int Nombre);
