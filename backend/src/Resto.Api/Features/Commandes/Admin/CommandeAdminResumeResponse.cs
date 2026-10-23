using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Admin;

public record CommandeAdminResumeResponse(
    int Id,
    string Numero,
    StatutCommande Statut,
    TypeCommande TypeCommande,
    string NomClient,
    string Telephone,
    int? TableNumero,
    decimal Total,
    bool EstPayee,
    int NombreArticles,
    DateTime DateCommande,
    DateTime DateMiseAJour);
