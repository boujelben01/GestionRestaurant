using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Admin;

public record CommandeAdminResponse(
    int Id,
    string Numero,
    StatutCommande Statut,
    IReadOnlyList<StatutCommande> StatutsSuivants,
    TypeCommande TypeCommande,
    ModePaiement ModePaiement,
    bool EstPayee,
    decimal SousTotal,
    decimal FraisLivraison,
    decimal Total,
    string? Note,
    string? AdresseLivraison,
    int? TableNumero,
    CommandeAdminClientResponse Client,
    DateTime DateCommande,
    DateTime DateMiseAJour,
    IReadOnlyList<CommandeAdminLigneResponse> Lignes,
    IReadOnlyList<CommandeAdminHistoriqueResponse> Historique,
    // Jeton de concurrence (xmin) à renvoyer dans PATCH .../statut pour détecter une modification concurrente.
    uint Version);
