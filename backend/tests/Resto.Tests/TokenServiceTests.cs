using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Options;
using Resto.Api.Common;
using Resto.Api.Domain;
using Resto.Api.Features.Auth;

namespace Resto.Tests;

public class TokenServiceTests
{
    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }

    private static readonly DateTimeOffset Now = new(2030, 1, 1, 12, 0, 0, TimeSpan.Zero);

    private static TokenService CreateService(string secret = "0123456789abcdef0123456789abcdef", int minutes = 60) =>
        new(Options.Create(new JwtOptions
        {
            Issuer = "resto-api",
            Audience = "resto-client",
            AccessTokenMinutes = minutes,
            SecretKey = secret
        }), new FixedTimeProvider(Now));

    private static readonly ApplicationUser User = new() { Id = "user-1", UserName = "yazid", Email = "yazid@resto.local" };

    [Fact]
    public void Token_contains_identity_claims_and_one_claim_per_role()
    {
        var access = CreateService().CreateAccessToken(User, [Roles.Admin, Roles.Client]);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(access.Token);

        Assert.Equal("user-1", jwt.Claims.Single(c => c.Type == "nameid").Value);
        Assert.Equal("yazid", jwt.Claims.Single(c => c.Type == "unique_name").Value);
        Assert.Equal("yazid@resto.local", jwt.Claims.Single(c => c.Type == "email").Value);
        Assert.False(string.IsNullOrEmpty(jwt.Id));
        Assert.Equal([Roles.Admin, Roles.Client], jwt.Claims.Where(c => c.Type == "role").Select(c => c.Value).Order());
        Assert.Equal("resto-api", jwt.Issuer);
        Assert.Contains("resto-client", jwt.Audiences);
        Assert.DoesNotContain(jwt.Claims, c => c.Type.Contains("panier", StringComparison.OrdinalIgnoreCase));
    }

    [Fact]
    public void Token_expires_after_configured_minutes()
    {
        var access = CreateService(minutes: 45).CreateAccessToken(User, [Roles.Client]);
        var jwt = new JwtSecurityTokenHandler().ReadJwtToken(access.Token);

        Assert.Equal(Now.UtcDateTime.AddMinutes(45), access.ExpiresAtUtc);
        Assert.Equal(Now.UtcDateTime.AddMinutes(45), jwt.ValidTo);
    }

    [Fact]
    public void Short_secret_key_is_rejected()
    {
        Assert.Throws<InvalidOperationException>(() => CreateService(secret: "trop-court"));
    }
}
