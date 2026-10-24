using Resto.Api.Domain;

namespace Resto.Api.Features.Tables;

public record SalleCommandeResponse(int Id, string Numero, StatutCommande Statut, decimal Total, bool EstPayee, DateTime DateCommande);
