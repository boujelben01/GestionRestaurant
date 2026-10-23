namespace Resto.Api.Features.Auth.Contracts;

public record LoginResponse(string Token, DateTime ExpiresAtUtc, UserResponse User);
