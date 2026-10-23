using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Auth.Contracts;

public record UpdateProfileRequest(
    [StringLength(100)] string? Nom,
    [Phone, StringLength(20)] string? Telephone,
    [Required, RegularExpression("^(fr|ar)$", ErrorMessage = "La langue doit être 'fr' ou 'ar'.")] string LangueFavorite);
