using System.ComponentModel.DataAnnotations;
using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Contracts;

public record CreerCommandeRequest(
    [Required] TypeCommande? TypeCommande,
    [Required, Phone, StringLength(20)] string Telephone,
    [StringLength(500)] string? Note = null,
    [StringLength(CommandeRules.AdresseMax)] string? AdresseLivraison = null,
    Guid? TableCode = null);
