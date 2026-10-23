using System.ComponentModel.DataAnnotations;
using Resto.Api.Common.Validation;

namespace Resto.Api.Features.Restaurant.Contracts;

public record UpdateRestaurantRequest(
    [Required, StringLength(100)] string Nom,
    [Required, Phone, StringLength(20)] string Telephone,
    [Required, EmailAddress, StringLength(150)] string Email,
    [Required, StringLength(300)] string Adresse,
    [Range(typeof(decimal), "0", "99999999.99", ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true), MaxDecimalPlaces(2)] decimal FraisLivraison,
    [Range(typeof(decimal), "0", "99999999.99", ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true), MaxDecimalPlaces(2)] decimal MontantMinimumLivraison);
