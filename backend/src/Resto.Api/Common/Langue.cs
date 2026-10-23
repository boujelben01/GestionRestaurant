namespace Resto.Api.Common;

public static class Langue
{
    public const string Francais = "fr";
    public const string Arabe = "ar";
    public const string Pattern = "^(fr|ar)$";

    public static string Normalize(string? lang) =>
        string.Equals(lang, Arabe, StringComparison.OrdinalIgnoreCase) ? Arabe : Francais;

    public static string Pick(string fr, string? ar, string lang) =>
        PickOptional(fr, ar, lang) ?? fr;

    public static string? PickOptional(string? fr, string? ar, string lang) =>
        Normalize(lang) == Arabe && !string.IsNullOrWhiteSpace(ar) ? ar : fr;
}
