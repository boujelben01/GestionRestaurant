using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;

namespace Resto.Api.Features.Commandes.Admin;

[ApiController]
[Route("api/admin/commandes")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminCommandesController(CommandeAdminService service) : ControllerBase
{
    /// <summary>
    /// Liste paginée, plus récentes d'abord. `statut` est répétable ou séparé par des virgules ;
    /// `du`/`au` : AAAA-MM-JJ (jour UTC entier) ou date-heure ISO 8601, bornes incluses.
    /// </summary>
    [HttpGet]
    public async Task<PagedResult<CommandeAdminResumeResponse>> List(
        [FromQuery] string[]? statut,
        [FromQuery] string? typeCommande,
        [FromQuery] bool? estPayee,
        [FromQuery] string? du,
        [FromQuery] string? au,
        [FromQuery] string? recherche,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        await service.ListAsync(statut, typeCommande, estPayee, du, au, recherche, page, pageSize, ct);

    /// <summary>Écran cuisine : EnAttente, EnPreparation, Prete ; plus anciennes d'abord, 200 au plus.</summary>
    [HttpGet("actives")]
    public async Task<IReadOnlyList<CommandeActiveResponse>> Actives(CancellationToken ct) =>
        await service.ActivesAsync(ct);

    /// <summary>Compteurs par statut du jour (Africa/Tunis) et nombre total de commandes en attente.</summary>
    [HttpGet("compteurs")]
    public async Task<CommandesCompteursResponse> Compteurs(CancellationToken ct) =>
        await service.CompteursAsync(ct);

    [HttpGet("{id:int}")]
    public async Task<CommandeAdminResponse> Get(int id, CancellationToken ct) =>
        await service.GetAsync(id, ct);

    [HttpPatch("{id:int}/statut")]
    public async Task<CommandeAdminResponse> ChangerStatut(int id, ChangerStatutRequest request, CancellationToken ct) =>
        await service.ChangerStatutAsync(User.GetUserId(), id, request.Statut!.Value, request.Version, ct);

    [HttpPatch("{id:int}/paiement")]
    public async Task<CommandeAdminResponse> SetPaiement(int id, SetPaiementRequest request, CancellationToken ct) =>
        await service.SetPaiementAsync(id, request.EstPayee!.Value, ct);
}
