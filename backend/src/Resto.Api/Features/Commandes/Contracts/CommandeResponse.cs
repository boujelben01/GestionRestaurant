using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Contracts;

public record CommandeResponse(
    int Id,
    string Numero,
    StatutCommande Statut,
    TypeCommande TypeCommande,
    ModePaiement ModePaiement,
    bool EstPayee,
    decimal SousTotal,
    decimal FraisLivraison,
    decimal Total,
    string? Note,
    string? AdresseLivraison,
    int? TableNumero,
    DateTime DateCommande,
    IReadOnlyList<CommandeLigneResponse> Lignes,
    IReadOnlyList<HistoriqueStatutResponse> Historique);
