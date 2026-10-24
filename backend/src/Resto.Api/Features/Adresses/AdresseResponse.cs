namespace Resto.Api.Features.Adresses;

public record AdresseResponse(int Id, string Libelle, string Ligne, string Ville, string? Details, string Telephone, bool EstParDefaut);
