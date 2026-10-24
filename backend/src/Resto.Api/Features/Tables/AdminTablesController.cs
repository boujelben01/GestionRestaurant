using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;

namespace Resto.Api.Features.Tables;

[ApiController]
[Route("api/admin/tables")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminTablesController(TableAdminService service, SalleService salle) : ControllerBase
{
    /// <summary>Toutes les tables, inactives incluses, par numéro.</summary>
    [HttpGet]
    public async Task<IReadOnlyList<TableAdminResponse>> List(CancellationToken ct) =>
        await service.ListAsync(ct);

    /// <summary>
    /// Plan de salle : pour chaque table, l'état calculé (Libre, Occupee, AEncaisser, Inactive), le total à
    /// encaisser et les commandes sur place à suivre.
    /// </summary>
    [HttpGet("salle")]
    public async Task<IReadOnlyList<SalleTableResponse>> Salle(CancellationToken ct) =>
        await salle.SalleAsync(ct);

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

    /// <summary>Marque payées toutes les commandes non payées et non annulées de la table (409 s'il n'y a rien à encaisser).</summary>
    [HttpPost("{id:int}/encaisser")]
    public async Task<SalleTableResponse> Encaisser(int id, CancellationToken ct) =>
        await salle.EncaisserAsync(id, ct);

    /// <summary>Libère la table : tout doit être payé et rien en cours ; les commandes « Prete » passent en « Terminee ».</summary>
    [HttpPost("{id:int}/liberer")]
    public async Task<SalleTableResponse> Liberer(int id, CancellationToken ct) =>
        await salle.LibererAsync(User.GetUserId(), id, ct);
}
