using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc.ModelBinding;

namespace Resto.Api.Features.Auth;

public static class IdentityResultExtensions
{
    public static bool IsDuplicate(this IdentityResult result) =>
        result.Errors.Any(e => e.Code is nameof(IdentityErrorDescriber.DuplicateUserName) or nameof(IdentityErrorDescriber.DuplicateEmail));

    public static ModelStateDictionary ToModelState(this IdentityResult result, string passwordField)
    {
        var modelState = new ModelStateDictionary();
        foreach (var error in result.Errors)
        {
            var field = error.Code switch
            {
                nameof(IdentityErrorDescriber.PasswordMismatch) => "CurrentPassword",
                var c when c.StartsWith("Password", StringComparison.Ordinal) => passwordField,
                var c when c.Contains("Email", StringComparison.Ordinal) => "Email",
                var c when c.Contains("UserName", StringComparison.Ordinal) => "UserName",
                _ => string.Empty
            };
            modelState.AddModelError(field, error.Description);
        }
        return modelState;
    }
}
