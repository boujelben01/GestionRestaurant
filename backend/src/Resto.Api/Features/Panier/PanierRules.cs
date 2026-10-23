namespace Resto.Api.Features.Panier;

public static class PanierRules
{
    public const int MaxQuantite = 20;

    public static int AddCapped(int existing, int added) => Math.Min(existing + added, MaxQuantite);
}
