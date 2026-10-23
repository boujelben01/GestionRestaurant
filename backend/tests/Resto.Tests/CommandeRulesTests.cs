using Resto.Api.Common;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Panier;

namespace Resto.Tests;

public class CommandeRulesTests
{
    private static readonly (decimal, int)[] Lignes = [(3.5m, 2), (4m, 1)];

    [Theory]
    [InlineData("10.005", "10.01")]
    [InlineData("10.004", "10.00")]
    [InlineData("0.125", "0.13")]
    public void Round_uses_two_decimals_away_from_zero(string input, string expected) =>
        Assert.Equal(decimal.Parse(expected, System.Globalization.CultureInfo.InvariantCulture),
            CommandeRules.Round(decimal.Parse(input, System.Globalization.CultureInfo.InvariantCulture)));

    [Fact]
    public void Totals_without_delivery_have_no_fee()
    {
        var totals = CommandeRules.ComputeTotals(Lignes, TypeCommande.ARemporter, fraisLivraison: 3m, minimumLivraison: 15m);

        Assert.Equal(new CommandeTotals(11m, 0m, 11m), totals);
        Assert.Equal(new CommandeTotals(11m, 0m, 11m), CommandeRules.ComputeTotals(Lignes, TypeCommande.SurPlace, 3m, 15m));
    }

    [Fact]
    public void Delivery_adds_the_restaurant_fee_when_minimum_is_reached()
    {
        var totals = CommandeRules.ComputeTotals([(5m, 3)], TypeCommande.Livraison, fraisLivraison: 3.005m, minimumLivraison: 15m);

        Assert.Equal(15m, totals.SousTotal);
        Assert.Equal(3.01m, totals.FraisLivraison);
        Assert.Equal(18.01m, totals.Total);
    }

    [Fact]
    public void Delivery_below_minimum_is_rejected_with_400()
    {
        var ex = Assert.Throws<AppException>(() =>
            CommandeRules.ComputeTotals(Lignes, TypeCommande.Livraison, 3m, 15m));

        Assert.Equal(400, ex.Status);
        Assert.Contains("15.00", ex.Message);
    }

    [Fact]
    public void Minimum_does_not_apply_to_other_types() =>
        Assert.Equal(11m, CommandeRules.ComputeTotals(Lignes, TypeCommande.ARemporter, 3m, 500m).Total);

    [Fact]
    public void Line_totals_are_rounded_before_summing() =>
        Assert.Equal(0.02m, CommandeRules.ComputeTotals([(0.005m, 1), (0.005m, 1)], TypeCommande.ARemporter, 0m, 0m).SousTotal);

    [Fact]
    public void Delivery_requires_an_address_between_10_and_500_characters()
    {
        Assert.Equal("AdresseLivraison", Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.Livraison, null, null)).Field);
        Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.Livraison, "court", null));
        Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.Livraison, new string('a', 501), null));
        CommandeRules.ValidateShape(TypeCommande.Livraison, "10 rue de la Paix, Tunis", null);
        CommandeRules.ValidateShape(TypeCommande.Livraison, new string('a', 10), null);
        CommandeRules.ValidateShape(TypeCommande.Livraison, new string('a', 500), null);
    }

    [Fact]
    public void Dine_in_requires_a_table_code_and_no_address()
    {
        Assert.Equal("TableCode", Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.SurPlace, null, null)).Field);
        Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.SurPlace, null, Guid.Empty));
        Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.SurPlace, "10 rue de la Paix", Guid.NewGuid()));
        CommandeRules.ValidateShape(TypeCommande.SurPlace, null, Guid.NewGuid());
    }

    [Fact]
    public void Takeaway_accepts_neither_address_nor_table()
    {
        CommandeRules.ValidateShape(TypeCommande.ARemporter, null, null);
        Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.ARemporter, "10 rue de la Paix", null));
        Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.ARemporter, null, Guid.NewGuid()));
    }

    [Fact]
    public void Delivery_rejects_a_table_code() =>
        Assert.Throws<AppException>(() => CommandeRules.ValidateShape(TypeCommande.Livraison, "10 rue de la Paix", Guid.NewGuid()));

    [Theory]
    [InlineData(0, 2, 2)]
    [InlineData(5, 3, 8)]
    [InlineData(19, 5, 20)]
    [InlineData(20, 1, 20)]
    public void Cart_quantity_is_capped_at_twenty(int existing, int added, int expected) =>
        Assert.Equal(expected, PanierRules.AddCapped(existing, added));
}
