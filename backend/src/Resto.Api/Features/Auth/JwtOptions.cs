namespace Resto.Api.Features.Auth;

public class JwtOptions
{
    public const string SectionName = "Jwt";
    public const int MinSecretKeyLength = 32;

    public string Issuer { get; set; } = string.Empty;
    public string Audience { get; set; } = string.Empty;
    public int AccessTokenMinutes { get; set; } = 60;
    public string SecretKey { get; set; } = string.Empty;
}
