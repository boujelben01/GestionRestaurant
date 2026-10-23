using System.Text.RegularExpressions;

namespace Resto.Api.Common.Validation;

public static partial class ImageUrlRules
{
    public const int MaxLength = 500;

    [GeneratedRegex(@"^/images/[A-Za-z0-9._\-/]+$")]
    private static partial Regex LocalPath();

    public static bool IsValid(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > MaxLength)
        {
            return false;
        }

        if (value.StartsWith("/images/", StringComparison.Ordinal))
        {
            return LocalPath().IsMatch(value)
                && !value.EndsWith('/')
                && !value.Contains("//", StringComparison.Ordinal)
                && !value.Split('/').Contains("..");
        }

        return value.All(c => !char.IsWhiteSpace(c) && !char.IsControl(c))
            && Uri.TryCreate(value, UriKind.Absolute, out var uri)
            && uri.Scheme == Uri.UriSchemeHttps
            && !string.IsNullOrEmpty(uri.Host)
            && string.IsNullOrEmpty(uri.UserInfo);
    }
}
