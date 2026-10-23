using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Auth.Contracts;

public record LoginRequest(
    [Required, StringLength(256)] string Identifiant,
    [Required, StringLength(100)] string Password);
