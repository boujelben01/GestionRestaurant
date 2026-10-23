namespace Resto.Api.Features.Commandes.Admin;

/// <param name="Date">Journée civile (fuseau Africa/Tunis) à laquelle se rapportent les compteurs par statut.</param>
/// <param name="ParStatut">Commandes passées aujourd'hui, un compteur par statut (0 inclus), dans l'ordre du cycle de vie.</param>
/// <param name="TotalAujourdhui">Commandes passées aujourd'hui, tous statuts.</param>
/// <param name="EnAttente">Commandes EnAttente, TOUTES dates confondues (pastille et alerte sonore : une commande oubliée hier compte).</param>
public record CommandesCompteursResponse(
    DateOnly Date,
    IReadOnlyList<CompteurStatutResponse> ParStatut,
    int TotalAujourdhui,
    int EnAttente);
