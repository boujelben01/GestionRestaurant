using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;

namespace Resto.Api.Features.Favoris;

/// <summary>Favoris du client connecté : l'identité est lue dans le jeton, jamais dans la requête.</summary>
[ApiController]
[Route("api/favoris")]
[Authorize]
public class FavorisController(FavoriService service) : ControllerBase
{
    /// <summary>Articles favoris dans la langue demandée (`lang=fr|ar`) ; un article désactivé reste listé avec `actif=false`.</summary>
    [HttpGet]
    public async Task<IReadOnlyList<FavoriResponse>> List(
        [FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await service.ListAsync(User.GetUserId(), lang, ct);

    /// <summary>Identifiants seulement, pour afficher les cœurs sans charger les articles.</summary>
    [HttpGet("ids")]
    public async Task<IReadOnlyList<int>> Ids(CancellationToken ct) =>
        await service.IdsAsync(User.GetUserId(), ct);

    [HttpPut("{articleId:int}")]
    public async Task<IActionResult> Add(int articleId, CancellationToken ct)
    {
        await service.AddAsync(User.GetUserId(), articleId, ct);
        return NoContent();
    }

    [HttpDelete("{articleId:int}")]
    public async Task<IActionResult> Remove(int articleId, CancellationToken ct)
    {
        await service.RemoveAsync(User.GetUserId(), articleId, ct);
        return NoContent();
    }
}
