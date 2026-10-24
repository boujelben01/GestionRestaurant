using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;

namespace Resto.Api.Features.Adresses;

/// <summary>Adresses du client connecté (10 au plus). L'identité est lue dans le jeton ; l'adresse d'un autre donne 404.</summary>
[ApiController]
[Route("api/adresses")]
[Authorize]
public class AdressesController(AdresseService service) : ControllerBase
{
    /// <summary>L'adresse par défaut d'abord, puis par ancienneté.</summary>
    [HttpGet]
    public async Task<IReadOnlyList<AdresseResponse>> List(CancellationToken ct) =>
        await service.ListAsync(User.GetUserId(), ct);

    [HttpPost]
    public async Task<ActionResult<AdresseResponse>> Create(AdresseRequest request, CancellationToken ct)
    {
        var created = await service.CreateAsync(User.GetUserId(), request, ct);
        return Created($"api/adresses/{created.Id}", created);
    }

    [HttpPut("{id:int}")]
    public async Task<AdresseResponse> Update(int id, AdresseRequest request, CancellationToken ct) =>
        await service.UpdateAsync(User.GetUserId(), id, request, ct);

    /// <summary>Suppression réelle : c'est une donnée personnelle.</summary>
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await service.DeleteAsync(User.GetUserId(), id, ct);
        return NoContent();
    }

    [HttpPatch("{id:int}/defaut")]
    public async Task<AdresseResponse> SetDefault(int id, CancellationToken ct) =>
        await service.SetDefaultAsync(User.GetUserId(), id, ct);
}
