using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Panier;

namespace Resto.Api.Features.Favoris;

/// <summary>
/// Favoris du client connecté (l'identité vient toujours du jeton). Le modèle `Favori` n'a PAS de date d'ajout et
/// aucune colonne n'est ajoutée (pas de migration) : la liste est triée par identifiant d'article décroissant,
/// c'est-à-dire du plat le plus récemment créé au plus ancien, et non par date d'ajout aux favoris.
/// </summary>
public class FavoriService(AppDbContext db)
{
    internal sealed record FavoriRow
    {
        public int Id { get; init; }
        public int CategorieId { get; init; }
        public string NomFr { get; init; } = string.Empty;
        public string? DescriptionFr { get; init; }
        public decimal Prix { get; init; }
        public string? ImageUrl { get; init; }
        public bool EstPopulaire { get; init; }
        public bool Disponible { get; init; }
        public bool Actif { get; init; }
    }

    // Requêtes isolées pour SqlTranslationTests : filtre et tri AVANT la projection, aucune agrégation.
    internal static IQueryable<FavoriRow> ListQuery(AppDbContext db, string userId) =>
        db.Favoris.AsNoTracking()
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.ArticleId)
            .Select(f => new FavoriRow
            {
                Id = f.Article.Id,
                CategorieId = f.Article.CategorieId,
                NomFr = f.Article.NomFr,
                DescriptionFr = f.Article.DescriptionFr,
                Prix = f.Article.Prix,
                ImageUrl = f.Article.ImageUrl,
                EstPopulaire = f.Article.EstPopulaire,
                Disponible = f.Article.EstDisponible,
                Actif = f.Article.EstActif && f.Article.Categorie.EstActive
            });

    internal static IQueryable<int> IdsQuery(AppDbContext db, string userId) =>
        db.Favoris.AsNoTracking()
            .Where(f => f.UserId == userId)
            .OrderByDescending(f => f.ArticleId)
            .Select(f => f.ArticleId);

    public async Task<IReadOnlyList<FavoriResponse>> ListAsync(string userId, CancellationToken ct)
    {
        var rows = await ListQuery(db, userId).ToListAsync(ct);
        return rows.Select(r => new FavoriResponse(
            r.Id,
            r.CategorieId,
            r.NomFr,
            r.DescriptionFr,
            r.Prix,
            r.ImageUrl,
            r.EstPopulaire,
            r.Disponible,
            r.Actif)).ToList();
    }

    public async Task<IReadOnlyList<int>> IdsAsync(string userId, CancellationToken ct) =>
        await IdsQuery(db, userId).ToListAsync(ct);

    /// <summary>Ajoute aux favoris (idempotent). 404 si l'article n'existe pas ou est inactif (lui ou sa catégorie).</summary>
    public async Task AddAsync(string userId, int articleId, CancellationToken ct)
    {
        var article = await db.Articles.AsNoTracking().Include(a => a.Categorie)
            .FirstOrDefaultAsync(a => a.Id == articleId, ct);
        if (article is null || ArticleAvailability.Of(article) == ArticleStatus.Inactif)
        {
            throw AppException.NotFound("Article introuvable.");
        }

        if (await db.Favoris.AnyAsync(f => f.UserId == userId && f.ArticleId == articleId, ct))
        {
            return;
        }

        db.Favoris.Add(new Favori { UserId = userId, ArticleId = articleId });
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            // Une requête concurrente l'a ajouté entre-temps (clé primaire composite) : le résultat voulu est atteint.
        }
    }

    /// <summary>Retire des favoris (idempotent : un article absent ne produit aucune erreur).</summary>
    public async Task RemoveAsync(string userId, int articleId, CancellationToken ct)
    {
        var favori = await db.Favoris.FirstOrDefaultAsync(f => f.UserId == userId && f.ArticleId == articleId, ct);
        if (favori is null)
        {
            return;
        }

        db.Favoris.Remove(favori);
        await db.SaveChangesAsync(ct);
    }
}
