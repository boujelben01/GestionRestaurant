using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;

namespace Resto.Api.Features.Statistiques;

/// <summary>
/// Statistiques du restaurant. `du` / `au` : jours civils Africa/Tunis (AAAA-MM-JJ), bornes incluses ;
/// défaut : les 30 derniers jours ; 366 jours au plus (sinon 400).
/// </summary>
[ApiController]
[Route("api/admin/statistiques")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminStatistiquesController(StatistiquesService service) : ControllerBase
{
    /// <summary>Indicateurs de la période, de la période précédente de même durée, et variations en %.</summary>
    [HttpGet("resume")]
    public async Task<ResumeResponse> Resume([FromQuery] string? du, [FromQuery] string? au, CancellationToken ct) =>
        await service.ResumeAsync(du, au, ct);

    /// <summary>Une entrée par jour de la période (jours sans vente à 0).</summary>
    [HttpGet("ventes-par-jour")]
    public async Task<IReadOnlyList<VenteJourResponse>> VentesParJour(
        [FromQuery] string? du, [FromQuery] string? au, CancellationToken ct) =>
        await service.VentesParJourAsync(du, au, ct);

    /// <summary>Articles les plus vendus (noms copiés sur les lignes), triés par quantité ; `limite` de 1 à 20.</summary>
    [HttpGet("top-articles")]
    public async Task<IReadOnlyList<TopArticleResponse>> TopArticles(
        [FromQuery] string? du, [FromQuery] string? au, [FromQuery] int? limite, CancellationToken ct) =>
        await service.TopArticlesAsync(du, au, limite, ct);

    /// <summary>24 entrées (heure locale de Tunis).</summary>
    [HttpGet("heures-de-pointe")]
    public async Task<IReadOnlyList<HeurePointeResponse>> HeuresDePointe(
        [FromQuery] string? du, [FromQuery] string? au, CancellationToken ct) =>
        await service.HeuresDePointeAsync(du, au, ct);

    /// <summary>Répartition par type de commande, par statut et par catégorie (« Autres » : article supprimé).</summary>
    [HttpGet("repartition")]
    public async Task<RepartitionResponse> Repartition(
        [FromQuery] string? du, [FromQuery] string? au, CancellationToken ct) =>
        await service.RepartitionAsync(du, au, ct);
}
