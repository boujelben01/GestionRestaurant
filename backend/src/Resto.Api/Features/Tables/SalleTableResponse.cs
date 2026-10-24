namespace Resto.Api.Features.Tables;

/// <param name="TotalAEncaisser">Somme des commandes non payées et non annulées de la table.</param>
/// <param name="NombreCommandes">Commandes à suivre (ni annulées, ni terminées-et-payées).</param>
/// <param name="PremiereCommandeUtc">Date de la plus ancienne commande à suivre (durée d'occupation), null si aucune.</param>
public record SalleTableResponse(
    int Id,
    int Numero,
    int Capacite,
    bool EstActive,
    EtatTable Etat,
    decimal TotalAEncaisser,
    int NombreCommandes,
    DateTime? PremiereCommandeUtc,
    IReadOnlyList<SalleCommandeResponse> Commandes);
