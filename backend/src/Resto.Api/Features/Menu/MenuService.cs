using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Menu.Contracts;

namespace Resto.Api.Features.Menu;

public class MenuService(AppDbContext db)
{
    public const int MaxPageSize = 50;

    public async Task<IReadOnlyList<MenuCategorieResponse>> GetMenuAsync(string lang, CancellationToken ct)
    {
        var categories = await db.Categories.AsNoTracking()
            .Where(c => c.EstActive)
            .OrderBy(c => c.Ordre).ThenBy(c => c.Id)
            .Include(c => c.Articles.Where(a => a.EstActif).OrderBy(a => a.Ordre).ThenBy(a => a.Id))
            .ToListAsync(ct);

        return categories
            .Select(c => new MenuCategorieResponse(
                c.Id,
                Langue.Pick(c.NomFr, c.NomAr, lang),
                c.Ordre,
                c.Articles.Select(a => ToResponse(a, lang)).ToList()))
            .ToList();
    }

    public async Task<IReadOnlyList<CategorieResponse>> GetCategoriesAsync(string lang, CancellationToken ct)
    {
        var categories = await db.Categories.AsNoTracking()
            .Where(c => c.EstActive)
            .OrderBy(c => c.Ordre).ThenBy(c => c.Id)
            .ToListAsync(ct);

        return categories.Select(c => new CategorieResponse(c.Id, Langue.Pick(c.NomFr, c.NomAr, lang), c.Ordre)).ToList();
    }

    public async Task<PagedResult<MenuArticleResponse>> GetArticlesAsync(
        string lang, int? categorieId, bool? populaire, string? recherche, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = VisibleArticles();
        if (categorieId is not null)
        {
            query = query.Where(a => a.CategorieId == categorieId);
        }
        if (populaire is not null)
        {
            query = query.Where(a => a.EstPopulaire == populaire);
        }
        if (!string.IsNullOrWhiteSpace(recherche))
        {
            var term = recherche.Trim().ToLower();
            query = query.Where(a => a.NomFr.ToLower().Contains(term) || a.NomAr.ToLower().Contains(term));
        }

        var total = await query.CountAsync(ct);
        var articles = await query
            .OrderBy(a => a.Categorie.Ordre).ThenBy(a => a.Ordre).ThenBy(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return new PagedResult<MenuArticleResponse>(articles.Select(a => ToResponse(a, lang)).ToList(), page, pageSize, total);
    }

    public async Task<MenuArticleResponse> GetArticleAsync(int id, string lang, CancellationToken ct)
    {
        var article = await VisibleArticles().FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("Article introuvable.");
        return ToResponse(article, lang);
    }

    public static MenuArticleResponse ToResponse(Article a, string lang) => new(
        a.Id,
        a.CategorieId,
        Langue.Pick(a.NomFr, a.NomAr, lang),
        Langue.PickOptional(a.DescriptionFr, a.DescriptionAr, lang),
        a.Prix,
        a.ImageUrl,
        a.EstPopulaire,
        a.EstDisponible);

    private IQueryable<Article> VisibleArticles() =>
        db.Articles.AsNoTracking().Where(a => a.EstActif && a.Categorie.EstActive);
}
