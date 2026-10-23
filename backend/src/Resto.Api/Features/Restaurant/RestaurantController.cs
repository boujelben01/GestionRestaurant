using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Features.Restaurant.Contracts;

namespace Resto.Api.Features.Restaurant;

[ApiController]
[Route("api/restaurant")]
public class RestaurantController(RestaurantService service) : ControllerBase
{
    [HttpGet]
    [AllowAnonymous]
    public async Task<RestaurantResponse> Get(CancellationToken ct) => await service.GetAsync(ct);
}
