using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Auth.Contracts;

public record ChangePasswordRequest(
    [Required, StringLength(100)] string CurrentPassword,
    [Required, StringLength(100, MinimumLength = 8)] string NewPassword);
