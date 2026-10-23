namespace Resto.Api.Data.Configurations;

internal static class EnumSql
{
    public static string InList<TEnum>(string column) where TEnum : struct, Enum =>
        $"\"{column}\" IN ({string.Join(", ", Enum.GetNames<TEnum>().Select(n => $"'{n}'"))})";
}
