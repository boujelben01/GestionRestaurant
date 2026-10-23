using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Menu.Admin;

public record ReorderRequest([Required, MinLength(1)] int[] Ids);
