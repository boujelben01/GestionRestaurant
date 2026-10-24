using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;

namespace Resto.Api.Features.Tables;

[ApiController]
[Route("api/admin/tables")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminTablesController(TableAdminService service) : ControllerBase
{
    /// <summary>Toutes les tables, inactives incluses, par numéro.</summary>
    [HttpGet]
    public async Task<IReadOnlyList<TableAdminResponse>> List(CancellationToken ct) =>
        await service.ListAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<TableAdminResponse> Get(int id, CancellationToken ct) =>
        await service.GetAsync(id, ct);

    [HttpPost]
    public async Task<ActionResult<TableAdminResponse>> Create(CreateTableRequest request, CancellationToken ct)
    {
        var created = await service.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpPut("{id:int}")]
    public async Task<TableAdminResponse> Update(int id, UpdateTableRequest request, CancellationToken ct) =>
        await service.UpdateAsync(id, request, ct);

    [HttpPatch("{id:int}/active")]
    public async Task<TableAdminResponse> SetActive(int id, SetTableActiveRequest request, CancellationToken ct) =>
        await service.SetActiveAsync(id, request.EstActive, ct);

    [HttpPost("{id:int}/regenerer-code")]
    public async Task<TableAdminResponse> RegenerateCode(int id, CancellationToken ct) =>
        await service.RegenerateCodeAsync(id, ct);
}
