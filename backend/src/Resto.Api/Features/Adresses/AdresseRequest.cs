using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Adresses;

/// <summary>Corps de POST et de PUT. Longueurs alignées sur AdresseConfiguration (EF).</summary>
public record AdresseRequest(
    [Required, StringLength(AdresseRules.LibelleMax)] string Libelle,
    [Required, StringLength(AdresseRules.LigneMax)] string Ligne,
    [Required, StringLength(AdresseRules.VilleMax)] string Ville,
    [Required, Phone, StringLength(AdresseRules.TelephoneMax)] string Telephone,
    [StringLength(AdresseRules.DetailsMax)] string? Details = null,
    bool EstParDefaut = false);
