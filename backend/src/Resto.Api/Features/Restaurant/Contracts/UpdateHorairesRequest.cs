using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Restaurant.Contracts;

public record UpdateHorairesRequest([Required] IReadOnlyList<HoraireRequest> Horaires);
