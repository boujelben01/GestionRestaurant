using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Menu.Admin;

public record CategorieRequest(
    [Required, StringLength(100)] string NomFr,
    [Range(0, 10000)] int? Ordre = null);
