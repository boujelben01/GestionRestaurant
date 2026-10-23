using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;
using Resto.Api.Features.Panier.Contracts;

namespace Resto.Api.Features.Panier;

[ApiController]
[Route("api/panier")]
[Authorize]
public class PanierController(PanierService service) : ControllerBase
{
    [HttpGet]
    public async Task<PanierResponse> Get([FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await service.GetAsync(User.GetUserId(), Langue.Normalize(lang), ct);

    [HttpPost("items")]
    public async Task<PanierResponse> AddItem(
        AddPanierItemRequest request, [FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await service.AddItemAsync(User.GetUserId(), request.ArticleId, request.Quantite, Langue.Normalize(lang), ct);

    [HttpPut("items/{articleId:int}")]
    public async Task<PanierResponse> SetQuantite(
        int articleId, SetQuantiteRequest request, [FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await service.SetQuantiteAsync(User.GetUserId(), articleId, request.Quantite, Langue.Normalize(lang), ct);

    [HttpDelete("items/{articleId:int}")]
    public async Task<PanierResponse> RemoveItem(
        int articleId, [FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await service.RemoveItemAsync(User.GetUserId(), articleId, Langue.Normalize(lang), ct);

    [HttpDelete]
    public async Task<PanierResponse> Clear(CancellationToken ct) =>
        await service.ClearAsync(User.GetUserId(), ct);
}
