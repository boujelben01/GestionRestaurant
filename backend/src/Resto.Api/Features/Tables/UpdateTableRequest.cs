using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Tables;

public record UpdateTableRequest(
    [Range(TableRules.NumeroMin, TableRules.NumeroMax)] int Numero,
    [Range(TableRules.CapaciteMin, TableRules.CapaciteMax)] int Capacite);
