using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Common.Validation;

[AttributeUsage(AttributeTargets.Property | AttributeTargets.Parameter)]
public sealed class ImageUrlAttribute : ValidationAttribute
{
    public ImageUrlAttribute()
        : base("ImageUrl doit être un chemin relatif commençant par /images/ ou une URL https.")
    {
    }

    public override bool IsValid(object? value) => value is null || (value is string s && ImageUrlRules.IsValid(s));
}
