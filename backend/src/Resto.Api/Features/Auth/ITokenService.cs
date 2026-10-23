using Resto.Api.Domain;

namespace Resto.Api.Features.Auth;

public record AccessToken(string Token, DateTime ExpiresAtUtc);

public interface ITokenService
{
    AccessToken CreateAccessToken(ApplicationUser user, IEnumerable<string> roles);
}
