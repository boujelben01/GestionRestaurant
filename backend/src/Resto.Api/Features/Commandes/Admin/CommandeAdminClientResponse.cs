namespace Resto.Api.Features.Commandes.Admin;

/// <summary>Client tel qu'enregistré sur la commande (copie figée) : nom et téléphone uniquement, rien d'Identity.</summary>
public record CommandeAdminClientResponse(string? UserId, string Nom, string Telephone);
