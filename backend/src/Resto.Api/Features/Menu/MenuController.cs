using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Resto.Api.Common;
using Resto.Api.Features.Menu.Contracts;

namespace Resto.Api.Features.Menu;

[ApiController]
[Route("api/menu")]
[AllowAnonymous]
[ResponseCache(Duration = 60, Location = ResponseCacheLocation.Any)]
public class MenuController(MenuService menu) : ControllerBase
{
    [HttpGet]
    public async Task<IReadOnlyList<MenuCategorieResponse>> GetMenu(
        [FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await menu.GetMenuAsync(Langue.Normalize(lang), ct);

    [HttpGet("categories")]
    public async Task<IReadOnlyList<CategorieResponse>> GetCategories(
        [FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await menu.GetCategoriesAsync(Langue.Normalize(lang), ct);

    [HttpGet("articles")]
    public async Task<PagedResult<MenuArticleResponse>> GetArticles(
        [FromQuery, RegularExpression(Langue.Pattern)] string? lang,
        [FromQuery] int? categorieId,
        [FromQuery] bool? populaire,
        [FromQuery, StringLength(100)] string? recherche,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken ct = default) =>
        await menu.GetArticlesAsync(Langue.Normalize(lang), categorieId, populaire, recherche, page, pageSize, ct);

    [HttpGet("articles/{id:int}")]
    public async Task<MenuArticleResponse> GetArticle(
        int id, [FromQuery, RegularExpression(Langue.Pattern)] string? lang, CancellationToken ct) =>
        await menu.GetArticleAsync(id, Langue.Normalize(lang), ct);
}
