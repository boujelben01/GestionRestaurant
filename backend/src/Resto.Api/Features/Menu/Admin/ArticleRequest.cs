using System.ComponentModel.DataAnnotations;
using Resto.Api.Common.Validation;

namespace Resto.Api.Features.Menu.Admin;

public record ArticleRequest(
    [Range(1, int.MaxValue)] int CategorieId,
    [Required, StringLength(150)] string NomFr,
    [Range(typeof(decimal), "0", "99999999.99", ParseLimitsInInvariantCulture = true, ConvertValueInInvariantCulture = true), MaxDecimalPlaces(2)] decimal Prix,
    [StringLength(1000)] string? DescriptionFr = null,
    [ImageUrl] string? ImageUrl = null,
    bool EstDisponible = true,
    bool EstPopulaire = false,
    [Range(0, 10000)] int? Ordre = null);
