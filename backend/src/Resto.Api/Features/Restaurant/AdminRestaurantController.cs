using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;
using Resto.Api.Features.Restaurant.Contracts;

namespace Resto.Api.Features.Restaurant;

[ApiController]
[Route("api/admin/restaurant")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminRestaurantController(RestaurantService service) : ControllerBase
{
    [HttpPut]
    public async Task<RestaurantResponse> Update(UpdateRestaurantRequest request, CancellationToken ct) =>
        await service.UpdateAsync(request, ct);

    [HttpPut("horaires")]
    public async Task<RestaurantResponse> UpdateHoraires(UpdateHorairesRequest request, CancellationToken ct) =>
        await service.UpdateHorairesAsync(request, ct);

    [HttpPatch("commandes-ouvertes")]
    public async Task<RestaurantResponse> SetCommandesOuvertes(SetCommandesOuvertesRequest request, CancellationToken ct) =>
        await service.SetCommandesOuvertesAsync(request.CommandesOuvertes, ct);
}
