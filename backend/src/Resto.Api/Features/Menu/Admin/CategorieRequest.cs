using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Menu.Admin;

public record CategorieRequest(
    [Required, StringLength(100)] string NomFr,
    [Required, StringLength(100)] string NomAr,
    [Range(0, 10000)] int? Ordre = null);
