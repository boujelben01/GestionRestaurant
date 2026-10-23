using Resto.Api.Domain;

namespace Resto.Api.Features.Auth.Contracts;

public record UserResponse(
    string Id,
    string UserName,
    string? Nom,
    string Email,
    string? Telephone,
    IReadOnlyList<string> Roles,
    string LangueFavorite)
{
    public static UserResponse From(ApplicationUser user, IEnumerable<string> roles) => new(
        user.Id,
        user.UserName ?? string.Empty,
        user.Nom,
        user.Email ?? string.Empty,
        user.PhoneNumber,
        roles.ToList(),
        user.LangueFavorite);
}
