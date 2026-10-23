using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Features.Commandes.Contracts;

namespace Resto.Api.Features.Commandes;

[ApiController]
[Route("api/tables")]
public class TablesController(CommandeService service) : ControllerBase
{
    [HttpGet("{code:guid}")]
    [AllowAnonymous]
    public async Task<TableResponse> Get(Guid code, CancellationToken ct) => await service.GetTableAsync(code, ct);
}
