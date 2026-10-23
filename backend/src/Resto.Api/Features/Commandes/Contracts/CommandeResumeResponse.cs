using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Contracts;

public record CommandeResumeResponse(
    int Id,
    string Numero,
    StatutCommande Statut,
    TypeCommande TypeCommande,
    decimal Total,
    int NombreArticles,
    DateTime DateCommande);
