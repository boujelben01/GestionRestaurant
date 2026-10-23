using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;
using Resto.Api.Features.Commandes.Contracts;

namespace Resto.Api.Features.Commandes;

[ApiController]
[Route("api/commandes")]
[Authorize]
public class CommandesController(CommandeService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<CommandeResponse>> Creer(CreerCommandeRequest request, CancellationToken ct)
    {
        var commande = await service.CreerAsync(User.GetUserId(), request, ct);
        return CreatedAtAction(nameof(Get), new { id = commande.Id }, commande);
    }

    [HttpGet]
    public async Task<PagedResult<CommandeResumeResponse>> List(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default) =>
        await service.ListAsync(User.GetUserId(), page, pageSize, ct);

    [HttpGet("{id:int}")]
    public async Task<CommandeResponse> Get(int id, CancellationToken ct) =>
        await service.GetAsync(User.GetUserId(), id, ct);

    [HttpPost("{id:int}/annuler")]
    public async Task<CommandeResponse> Annuler(int id, CancellationToken ct) =>
        await service.AnnulerAsync(User.GetUserId(), id, ct);
}
