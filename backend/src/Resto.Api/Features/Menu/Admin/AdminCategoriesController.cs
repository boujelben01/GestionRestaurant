using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;

namespace Resto.Api.Features.Menu.Admin;

[ApiController]
[Route("api/admin/categories")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminCategoriesController(CategorieAdminService service) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<CategorieAdminResponse>> List(CancellationToken ct) =>
        await service.ListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<CategorieAdminResponse> Get(int id, CancellationToken ct) =>
        await service.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<CategorieAdminResponse>> Create(CategorieRequest request, CancellationToken ct)
    {
        var created = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<CategorieAdminResponse> Update(int id, CategorieRequest request, CancellationToken ct) =>
        await service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:int}/active")]
    public async Task<CategorieAdminResponse> SetActive(int id, SetActiveRequest request, CancellationToken ct) =>
        await service.SetActiveAsync(id, request.EstActive, ct);

    [HttpPut("ordre")]
    public async Task<IReadOnlyList<CategorieAdminResponse>> Reorder(ReorderRequest request, CancellationToken ct) =>
        await service.ReorderAsync(request.Ids, ct);
}
