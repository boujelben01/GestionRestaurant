using Resto.Api.Common.Validation;

namespace Resto.Tests;

public class ImageUrlRulesTests
{
    [Theory]
    [InlineData("/images/pizza.jpg")]
    [InlineData("/images/default.svg")]
    [InlineData("/images/plats/plat-tounsi.jpg")]
    [InlineData("https://cdn.example.com/a.png")]
    public void Accepts_local_images_and_https(string url) => Assert.True(ImageUrlRules.IsValid(url));

    [Theory]
    [InlineData("")]
    [InlineData("javascript:alert(1)")]
    [InlineData("data:image/png;base64,AAAA")]
    [InlineData("http://example.com/a.png")]
    [InlineData("//evil.example.com/a.png")]
    [InlineData("images/pizza.jpg")]
    [InlineData("/other/pizza.jpg")]
    [InlineData("/images/")]
    [InlineData("/images/../secret.txt")]
    [InlineData("/images/a//b.png")]
    [InlineData("/images/a b.png")]
    [InlineData("/images/a.png?x=1")]
    [InlineData("\\images\\a.png")]
    [InlineData("https://user:pw@example.com/a.png")]
    [InlineData("https://exa mple.com/a.png")]
    public void Rejects_unsafe_values(string url) => Assert.False(ImageUrlRules.IsValid(url));

    [Fact]
    public void Rejects_values_longer_than_500_characters() =>
        Assert.False(ImageUrlRules.IsValid("/images/" + new string('a', 500)));

    [Fact]
    public void Attribute_accepts_null_because_the_image_is_optional() =>
        Assert.True(new ImageUrlAttribute().IsValid(null));

    [Theory]
    [InlineData("1.50", true)]
    [InlineData("1.505", false)]
    public void MaxDecimalPlaces_limits_precision(string value, bool expected) =>
        Assert.Equal(expected, new MaxDecimalPlacesAttribute(2).IsValid(decimal.Parse(value, System.Globalization.CultureInfo.InvariantCulture)));
}
