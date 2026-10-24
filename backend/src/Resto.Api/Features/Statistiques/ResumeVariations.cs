namespace Resto.Api.Features.Statistiques;

/// <summary>Variation en % par rapport à la période précédente (1 décimale) ; null si la valeur précédente est 0.</summary>
public record ResumeVariations(
    decimal? ChiffreAffaires,
    decimal? NombreCommandes,
    decimal? PanierMoyen,
    decimal? NombreAnnulees,
    decimal? MontantAEncaisser,
    decimal? NouveauxClients);
