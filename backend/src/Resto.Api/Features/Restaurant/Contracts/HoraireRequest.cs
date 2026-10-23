using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Restaurant.Contracts;

public record HoraireRequest(
    [Range(0, 6)] int JourSemaine,
    [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "Format attendu : HH:mm.")] string? Ouverture,
    [RegularExpression(@"^([01]\d|2[0-3]):[0-5]\d$", ErrorMessage = "Format attendu : HH:mm.")] string? Fermeture,
    bool EstFerme);
