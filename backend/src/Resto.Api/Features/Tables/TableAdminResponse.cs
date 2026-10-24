namespace Resto.Api.Features.Tables;

/// <summary>Table vue par l'admin. `Code` est le GUID encodé dans le QR (/table/{code}) : à ne montrer qu'à l'admin.</summary>
public record TableAdminResponse(int Id, int Numero, Guid Code, int Capacite, bool EstActive);
