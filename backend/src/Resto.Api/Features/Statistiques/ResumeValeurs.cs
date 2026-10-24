namespace Resto.Api.Features.Statistiques;

/// <param name="ChiffreAffaires">Somme des lignes (PrixUnitaire × Quantite) des commandes non annulées, hors frais de livraison.</param>
/// <param name="NombreCommandes">Commandes non annulées.</param>
/// <param name="PanierMoyen">ChiffreAffaires / NombreCommandes (0 s'il n'y a aucune commande).</param>
/// <param name="NombreAnnulees">Commandes annulées.</param>
/// <param name="MontantAEncaisser">Total (frais de livraison inclus) des commandes non annulées et non payées.</param>
/// <param name="NouveauxClients">Comptes Client créés pendant la période.</param>
public record ResumeValeurs(
    decimal ChiffreAffaires,
    int NombreCommandes,
    decimal PanierMoyen,
    int NombreAnnulees,
    decimal MontantAEncaisser,
    int NouveauxClients);
