namespace Resto.Api.Common;

public static class Policies
{
    public const string AdminOnly = "AdminOnly";
    public const string ClientOnly = "ClientOnly";
    public const string AuthRateLimit = "auth";
}
