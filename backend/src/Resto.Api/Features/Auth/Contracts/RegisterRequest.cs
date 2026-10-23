using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Auth.Contracts;

public record RegisterRequest(
    [Required, StringLength(100)] string Nom,
    [Required, EmailAddress, StringLength(256)] string Email,
    [Required, StringLength(100, MinimumLength = 8)] string Password,
    [StringLength(50, MinimumLength = 3)] string? UserName = null,
    [Phone, StringLength(20)] string? Telephone = null,
    [RegularExpression("^(fr|ar)$", ErrorMessage = "La langue doit être 'fr' ou 'ar'.")] string? LangueFavorite = "fr");
