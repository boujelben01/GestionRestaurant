using Resto.Api.Common;

namespace Resto.Tests;

public class LangueTests
{
    [Theory]
    [InlineData(null, "fr")]
    [InlineData("", "fr")]
    [InlineData("fr", "fr")]
    [InlineData("ar", "ar")]
    [InlineData("AR", "ar")]
    [InlineData("de", "fr")]
    public void Normalize_defaults_to_french(string? input, string expected) =>
        Assert.Equal(expected, Langue.Normalize(input));

    [Fact]
    public void Pick_returns_arabic_when_requested_and_present() =>
        Assert.Equal("بريك", Langue.Pick("Brik", "بريك", "ar"));

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Pick_falls_back_to_french_when_translation_is_empty(string? ar) =>
        Assert.Equal("Brik", Langue.Pick("Brik", ar, "ar"));

    [Fact]
    public void Pick_returns_french_when_french_requested() =>
        Assert.Equal("Brik", Langue.Pick("Brik", "بريك", "fr"));

    [Fact]
    public void PickOptional_keeps_null_when_both_missing() =>
        Assert.Null(Langue.PickOptional(null, null, "ar"));

    [Fact]
    public void PickOptional_falls_back_to_french_description() =>
        Assert.Equal("Description", Langue.PickOptional("Description", null, "ar"));
}
