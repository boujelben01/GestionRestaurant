using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Api.Features.Menu.Admin;

public class ArticleAdminService(AppDbContext db, TimeProvider time)
{
    public const int MaxPageSize = 50;

    public async Task<PagedResult<ArticleAdminResponse>> ListAsync(
        int? categorieId, bool? actif, bool? disponible, string? recherche, int page, int pageSize, CancellationToken ct)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = FilteredQuery(db, categorieId, actif, disponible, recherche);
        var total = await query.CountAsync(ct);
        var items = await PageQuery(query, page, pageSize).ToListAsync(ct);

        return new PagedResult<ArticleAdminResponse>(items.Select(ToResponse).ToList(), page, pageSize, total);
    }

    // Requêtes de liste isolées pour que SqlTranslationTests vérifie leur traduction avec le fournisseur Npgsql
    // (EF InMemory ne détecte pas les expressions intraduisibles en SQL).
    internal static IQueryable<Article> FilteredQuery(
        AppDbContext db, int? categorieId, bool? actif, bool? disponible, string? recherche)
    {
        var query = db.Articles.AsNoTracking().AsQueryable();
        if (categorieId is not null)
        {
            query = query.Where(a => a.CategorieId == categorieId);
        }

        if (actif is not null)
        {
            query = query.Where(a => a.EstActif == actif);
        }

        if (disponible is not null)
        {
            query = query.Where(a => a.EstDisponible == disponible);
        }

        if (!string.IsNullOrWhiteSpace(recherche))
        {
            var term = recherche.Trim().ToLower();
            query = query.Where(a => a.NomFr.ToLower().Contains(term) || a.NomAr.ToLower().Contains(term));
        }

        return query;
    }

    internal static IQueryable<Article> PageQuery(IQueryable<Article> filtered, int page, int pageSize) =>
        filtered
            .OrderBy(a => a.Categorie.Ordre).ThenBy(a => a.Ordre).ThenBy(a => a.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize);

    public async Task<ArticleAdminResponse> GetAsync(int id, CancellationToken ct) =>
        ToResponse(await db.Articles.AsNoTracking().FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("Article introuvable."));

    public async Task<ArticleAdminResponse> CreateAsync(ArticleRequest request, CancellationToken ct)
    {
        await EnsureCategorieExistsAsync(request.CategorieId, ct);

        var now = time.GetUtcNow().UtcDateTime;
        var article = new Article
        {
            EstActif = true,
            DateCreation = now,
            Ordre = request.Ordre
                ?? (await db.Articles.Where(a => a.CategorieId == request.CategorieId).MaxAsync(a => (int?)a.Ordre, ct) ?? 0) + 1
        };
        Apply(article, request, now);

        db.Articles.Add(article);
        await db.SaveChangesAsync(ct);
        return ToResponse(article);
    }

    public async Task<ArticleAdminResponse> UpdateAsync(int id, ArticleRequest request, CancellationToken ct)
    {
        var article = await FindAsync(id, ct);
        await EnsureCategorieExistsAsync(request.CategorieId, ct);

        Apply(article, request, time.GetUtcNow().UtcDateTime);
        article.Ordre = request.Ordre ?? article.Ordre;
        await db.SaveChangesAsync(ct);
        return ToResponse(article);
    }

    public async Task<ArticleAdminResponse> SetDisponibleAsync(int id, bool estDisponible, CancellationToken ct)
    {
        var article = await FindAsync(id, ct);
        article.EstDisponible = estDisponible;
        article.DateMiseAJour = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return ToResponse(article);
    }

    public async Task<ArticleAdminResponse> SetActifAsync(int id, bool estActif, CancellationToken ct)
    {
        var article = await FindAsync(id, ct);
        article.EstActif = estActif;
        article.DateMiseAJour = time.GetUtcNow().UtcDateTime;
        await db.SaveChangesAsync(ct);
        return ToResponse(article);
    }

    public async Task<IReadOnlyList<ArticleAdminResponse>> ReorderAsync(int[] ids, CancellationToken ct)
    {
        if (ids.Distinct().Count() != ids.Length)
        {
            throw AppException.Invalid(nameof(ReorderRequest.Ids), "La liste contient des identifiants en double.");
        }

        var listed = await db.Articles.Where(a => ids.Contains(a.Id)).ToListAsync(ct);
        var unknown = ids.Except(listed.Select(a => a.Id)).ToList();
        if (unknown.Count > 0)
        {
            throw AppException.Invalid(nameof(ReorderRequest.Ids), $"Article(s) inconnu(s) : {string.Join(", ", unknown)}.");
        }

        var categorieIds = listed.Select(a => a.CategorieId).Distinct().ToList();
        if (categorieIds.Count != 1)
        {
            throw AppException.Invalid(nameof(ReorderRequest.Ids), "Tous les articles doivent appartenir à la même catégorie.");
        }

        var categorieId = categorieIds[0];
        var others = await db.Articles
            .Where(a => a.CategorieId == categorieId && !ids.Contains(a.Id))
            .OrderBy(a => a.Ordre).ThenBy(a => a.Id)
            .ToListAsync(ct);

        var byId = listed.ToDictionary(a => a.Id);
        var now = time.GetUtcNow().UtcDateTime;
        var ordre = 1;
        foreach (var article in ids.Select(i => byId[i]).Concat(others))
        {
            article.Ordre = ordre++;
            article.DateMiseAJour = now;
        }

        await db.SaveChangesAsync(ct);
        return (await db.Articles.AsNoTracking()
                .Where(a => a.CategorieId == categorieId)
                .OrderBy(a => a.Ordre).ThenBy(a => a.Id)
                .ToListAsync(ct))
            .Select(ToResponse).ToList();
    }

    private static void Apply(Article article, ArticleRequest request, DateTime now)
    {
        article.CategorieId = request.CategorieId;
        article.NomFr = request.NomFr.Trim();
        article.NomAr = request.NomAr.Trim();
        article.DescriptionFr = NullIfBlank(request.DescriptionFr);
        article.DescriptionAr = NullIfBlank(request.DescriptionAr);
        article.Prix = request.Prix;
        article.ImageUrl = request.ImageUrl;
        article.EstDisponible = request.EstDisponible;
        article.EstPopulaire = request.EstPopulaire;
        article.DateMiseAJour = now;
    }

    private static string? NullIfBlank(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private async Task<Article> FindAsync(int id, CancellationToken ct) =>
        await db.Articles.FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw AppException.NotFound("Article introuvable.");

    private async Task EnsureCategorieExistsAsync(int categorieId, CancellationToken ct)
    {
        if (!await db.Categories.AnyAsync(c => c.Id == categorieId, ct))
        {
            throw AppException.Invalid(nameof(ArticleRequest.CategorieId), "Cette catégorie n'existe pas.");
        }
    }

    private static ArticleAdminResponse ToResponse(Article a) => new(
        a.Id, a.CategorieId, a.NomFr, a.NomAr, a.DescriptionFr, a.DescriptionAr, a.Prix, a.ImageUrl,
        a.EstDisponible, a.EstActif, a.EstPopulaire, a.Ordre, a.DateCreation, a.DateMiseAJour);
}
