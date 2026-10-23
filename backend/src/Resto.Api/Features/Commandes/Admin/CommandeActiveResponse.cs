using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Admin;

/// <summary>Commande à traiter, pour l'écran cuisine : le résumé plus les lignes à préparer et la note.</summary>
public record CommandeActiveResponse(
    int Id,
    string Numero,
    StatutCommande Statut,
    TypeCommande TypeCommande,
    string NomClient,
    int? TableNumero,
    string? Note,
    DateTime DateCommande,
    DateTime DateMiseAJour,
    IReadOnlyList<CommandeActiveLigneResponse> Lignes,
    uint Version);
