using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Resto.Api.Domain;

namespace Resto.Api.Features.Auth;

public class TokenService : ITokenService
{
    private readonly JwtOptions _options;
    private readonly TimeProvider _time;
    private readonly SigningCredentials _credentials;
    private readonly JwtSecurityTokenHandler _handler = new();

    public TokenService(IOptions<JwtOptions> options, TimeProvider time)
    {
        _options = options.Value;
        _time = time;

        if (_options.SecretKey.Length < JwtOptions.MinSecretKeyLength)
        {
            throw new InvalidOperationException(
                $"Jwt:SecretKey doit contenir au moins {JwtOptions.MinSecretKeyLength} caractères.");
        }

        _credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.SecretKey)),
            SecurityAlgorithms.HmacSha256);
    }

    public AccessToken CreateAccessToken(ApplicationUser user, IEnumerable<string> roles)
    {
        var now = _time.GetUtcNow().UtcDateTime;
        var expires = now.AddMinutes(_options.AccessTokenMinutes);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id),
            new(ClaimTypes.Name, user.UserName ?? string.Empty),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
        };
        if (!string.IsNullOrEmpty(user.Email))
        {
            claims.Add(new Claim(ClaimTypes.Email, user.Email));
        }
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));

        var token = _handler.CreateToken(new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(claims),
            Issuer = _options.Issuer,
            Audience = _options.Audience,
            NotBefore = now,
            Expires = expires,
            SigningCredentials = _credentials
        });

        return new AccessToken(_handler.WriteToken(token), expires);
    }
}
