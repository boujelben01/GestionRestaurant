using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Admin;

/// <summary>Un changement de statut avec son auteur (null si le compte a été supprimé depuis).</summary>
public record CommandeAdminHistoriqueResponse(StatutCommande Statut, DateTime Date, string? ParUserId, string? ParNom);
