using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Common.Validation;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class MaxDecimalPlacesAttribute(int places)
    : ValidationAttribute($"Au maximum {places} décimales sont autorisées.")
{
    public override bool IsValid(object? value) =>
        value is null || (value is decimal d && decimal.Round(d, places) == d);
}
