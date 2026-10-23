namespace Resto.Api.Features.Admin;

public record AdminUserResponse(string Id, string UserName, string Email, string? Nom, bool EstActif, DateTime DateCreation);
