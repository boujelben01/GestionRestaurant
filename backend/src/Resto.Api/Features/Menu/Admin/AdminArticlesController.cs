using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;
using Resto.Api.Features.Admin;

namespace Resto.Api.Features.Menu.Admin;

[ApiController]
[Route("api/admin/articles")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminArticlesController(ArticleAdminService service) : ControllerBase
{
    [HttpGet]
    public async Task<PagedResult<ArticleAdminResponse>> List(
        [FromQuery] int? categorieId,
        [FromQuery] bool? actif,
        [FromQuery] bool? disponible,
        [FromQuery] string? recherche,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        await service.ListAsync(categorieId, actif, disponible, recherche, page, pageSize, ct);

    [HttpGet("{id:int}")]
    public async Task<ArticleAdminResponse> Get(int id, CancellationToken ct) =>
        await service.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<ArticleAdminResponse>> Create(ArticleRequest request, CancellationToken ct)
    {
        var created = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<ArticleAdminResponse> Update(int id, ArticleRequest request, CancellationToken ct) =>
        await service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:int}/disponible")]
    public async Task<ArticleAdminResponse> SetDisponible(int id, SetDisponibleRequest request, CancellationToken ct) =>
        await service.SetDisponibleAsync(id, request.EstDisponible, ct);

    [HttpPatch("{id:int}/actif")]
    public async Task<ArticleAdminResponse> SetActif(int id, SetActifRequest request, CancellationToken ct) =>
        await service.SetActifAsync(id, request.EstActif, ct);

    [HttpPut("ordre")]
    public async Task<IReadOnlyList<ArticleAdminResponse>> Reorder(ReorderRequest request, CancellationToken ct) =>
        await service.ReorderAsync(request.Ids, ct);
}
