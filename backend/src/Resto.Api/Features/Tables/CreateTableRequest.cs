using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Tables;

/// <param name="Numero">Facultatif : par défaut, le plus grand numéro existant + 1.</param>
public record CreateTableRequest(
    [Range(TableRules.NumeroMin, TableRules.NumeroMax)] int? Numero,
    [Range(TableRules.CapaciteMin, TableRules.CapaciteMax)] int Capacite);
