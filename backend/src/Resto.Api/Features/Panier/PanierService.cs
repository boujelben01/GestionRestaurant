using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Panier.Contracts;

namespace Resto.Api.Features.Panier;

public class PanierService(AppDbContext db, TimeProvider time)
{
    public async Task<PanierResponse> GetAsync(string userId, CancellationToken ct)
    {
        var panier = await GetOrCreateAsync(userId, ct);
        return await BuildAsync(panier.Id, ct);
    }

    public async Task<PanierResponse> AddItemAsync(string userId, int articleId, int quantite, CancellationToken ct)
    {
        await EnsureOrderableAsync(articleId, ct);
        var panier = await GetOrCreateAsync(userId, ct);

        var item = await FindItemAsync(panier.Id, articleId, ct);
        if (item is null)
        {
            db.PanierItems.Add(new PanierItem { PanierId = panier.Id, ArticleId = articleId, Quantite = PanierRules.AddCapped(0, quantite) });
        }
        else
        {
            item.Quantite = PanierRules.AddCapped(item.Quantite, quantite);
        }

        panier.DateMiseAJour = Now();
        await db.SaveChangesAsync(ct);
        return await BuildAsync(panier.Id, ct);
    }

    public async Task<PanierResponse> SetQuantiteAsync(string userId, int articleId, int quantite, CancellationToken ct)
    {
        var panier = await GetOrCreateAsync(userId, ct);
        var item = await FindItemAsync(panier.Id, articleId, ct);

        if (item is null || quantite > item.Quantite)
        {
            await EnsureOrderableAsync(articleId, ct);
        }

        if (item is null)
        {
            db.PanierItems.Add(new PanierItem { PanierId = panier.Id, ArticleId = articleId, Quantite = quantite });
        }
        else
        {
            item.Quantite = quantite;
        }

        panier.DateMiseAJour = Now();
        await db.SaveChangesAsync(ct);
        return await BuildAsync(panier.Id, ct);
    }

    public async Task<PanierResponse> RemoveItemAsync(string userId, int articleId, CancellationToken ct)
    {
        var panier = await db.Paniers.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (panier is null)
        {
            return Empty();
        }

        var item = await FindItemAsync(panier.Id, articleId, ct);
        if (item is not null)
        {
            db.PanierItems.Remove(item);
            panier.DateMiseAJour = Now();
            await db.SaveChangesAsync(ct);
        }

        return await BuildAsync(panier.Id, ct);
    }

    public async Task<PanierResponse> ClearAsync(string userId, CancellationToken ct)
    {
        var panier = await db.Paniers.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (panier is null)
        {
            return Empty();
        }

        db.PanierItems.RemoveRange(await db.PanierItems.Where(i => i.PanierId == panier.Id).ToListAsync(ct));
        panier.DateMiseAJour = Now();
        await db.SaveChangesAsync(ct);
        return await BuildAsync(panier.Id, ct);
    }

    private async Task<Domain.Panier> GetOrCreateAsync(string userId, CancellationToken ct)
    {
        var panier = await db.Paniers.FirstOrDefaultAsync(p => p.UserId == userId, ct);
        if (panier is not null)
        {
            return panier;
        }

        panier = new Domain.Panier { UserId = userId, DateMiseAJour = Now() };
        db.Paniers.Add(panier);
        try
        {
            await db.SaveChangesAsync(ct);
            return panier;
        }
        catch (DbUpdateException ex) when (ex.IsUniqueViolation())
        {
            // Une requête concurrente a créé le panier entre-temps (index unique sur UserId).
            db.Entry(panier).State = EntityState.Detached;
            return await db.Paniers.FirstAsync(p => p.UserId == userId, ct);
        }
    }

    private Task<PanierItem?> FindItemAsync(int panierId, int articleId, CancellationToken ct) =>
        db.PanierItems.FirstOrDefaultAsync(i => i.PanierId == panierId && i.ArticleId == articleId, ct);

    private async Task EnsureOrderableAsync(int articleId, CancellationToken ct)
    {
        var article = await db.Articles.AsNoTracking().Include(a => a.Categorie).FirstOrDefaultAsync(a => a.Id == articleId, ct);
        var status = article is null ? ArticleStatus.Inactif : ArticleAvailability.Of(article);

        switch (status)
        {
            case ArticleStatus.Inactif:
                throw AppException.NotFound("Article introuvable.");
            case ArticleStatus.Indisponible:
                throw AppException.Conflict("Cet article n'est pas disponible pour le moment.");
        }
    }

    private async Task<PanierResponse> BuildAsync(int panierId, CancellationToken ct)
    {
        var items = await db.PanierItems.AsNoTracking()
            .Include(i => i.Article).ThenInclude(a => a.Categorie)
            .Where(i => i.PanierId == panierId)
            .OrderBy(i => i.Id)
            .ToListAsync(ct);
        var updated = await db.Paniers.AsNoTracking().Where(p => p.Id == panierId).Select(p => (DateTime?)p.DateMiseAJour).FirstOrDefaultAsync(ct);

        var lignes = items.Select(i =>
        {
            var a = i.Article;
            var status = ArticleAvailability.Of(a);
            return new PanierLigneResponse(
                a.Id,
                a.NomFr,
                a.Prix,
                a.ImageUrl,
                status == ArticleStatus.Ok,
                i.Quantite,
                CommandeRules.Round(a.Prix * i.Quantite),
                status switch
                {
                    ArticleStatus.Inactif => "inactif",
                    ArticleStatus.Indisponible => "indisponible",
                    _ => null
                });
        }).ToList();

        return new PanierResponse(lignes, lignes.Sum(l => l.Quantite), lignes.Sum(l => l.TotalLigne), updated);
    }

    private static PanierResponse Empty() => new([], 0, 0m, null);

    private DateTime Now() => time.GetUtcNow().UtcDateTime;
}
