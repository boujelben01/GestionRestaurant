using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Api.Features.Menu.Admin;

public class CategorieAdminService(AppDbContext db)
{
    public async Task<IReadOnlyList<CategorieAdminResponse>> ListAsync(CancellationToken ct) =>
        await Projected().OrderBy(c => c.Ordre).ThenBy(c => c.Id).ToListAsync(ct);

    public async Task<CategorieAdminResponse> GetAsync(int id, CancellationToken ct) =>
        await Projected().FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Catégorie introuvable.");

    public async Task<CategorieAdminResponse> CreateAsync(CategorieRequest request, CancellationToken ct)
    {
        var nomFr = request.NomFr.Trim();
        await EnsureNameAvailableAsync(nomFr, null, ct);

        var categorie = new Categorie
        {
            NomFr = nomFr,
            NomAr = request.NomAr.Trim(),
            Ordre = request.Ordre ?? (await db.Categories.MaxAsync(c => (int?)c.Ordre, ct) ?? 0) + 1,
            EstActive = true
        };
        db.Categories.Add(categorie);
        await db.SaveChangesAsync(ct);
        return await GetAsync(categorie.Id, ct);
    }

    public async Task<CategorieAdminResponse> UpdateAsync(int id, CategorieRequest request, CancellationToken ct)
    {
        var categorie = await FindAsync(id, ct);
        var nomFr = request.NomFr.Trim();
        await EnsureNameAvailableAsync(nomFr, id, ct);

        categorie.NomFr = nomFr;
        categorie.NomAr = request.NomAr.Trim();
        categorie.Ordre = request.Ordre ?? categorie.Ordre;
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<CategorieAdminResponse> SetActiveAsync(int id, bool estActive, CancellationToken ct)
    {
        var categorie = await FindAsync(id, ct);

        if (!estActive)
        {
            var actifs = await db.Articles.CountAsync(a => a.CategorieId == id && a.EstActif, ct);
            if (actifs > 0)
            {
                throw AppException.Conflict(
                    $"Impossible de désactiver cette catégorie : elle contient {actifs} article(s) actif(s). Désactivez-les d'abord.");
            }
        }

        categorie.EstActive = estActive;
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<IReadOnlyList<CategorieAdminResponse>> ReorderAsync(int[] ids, CancellationToken ct)
    {
        if (ids.Distinct().Count() != ids.Length)
        {
            throw AppException.Invalid(nameof(ReorderRequest.Ids), "La liste contient des identifiants en double.");
        }

        var all = await db.Categories.OrderBy(c => c.Ordre).ThenBy(c => c.Id).ToListAsync(ct);
        var byId = all.ToDictionary(c => c.Id);
        var unknown = ids.Where(i => !byId.ContainsKey(i)).ToList();
        if (unknown.Count > 0)
        {
            throw AppException.Invalid(nameof(ReorderRequest.Ids), $"Catégorie(s) inconnue(s) : {string.Join(", ", unknown)}.");
        }

        var ordered = ids.Select(i => byId[i]).Concat(all.Where(c => !ids.Contains(c.Id)));
        var ordre = 1;
        foreach (var categorie in ordered)
        {
            categorie.Ordre = ordre++;
        }

        await db.SaveChangesAsync(ct);
        return await ListAsync(ct);
    }

    private IQueryable<CategorieAdminResponse> Projected() =>
        db.Categories.AsNoTracking().Select(c => new CategorieAdminResponse(
            c.Id, c.NomFr, c.NomAr, c.Ordre, c.EstActive, c.Articles.Count(a => a.EstActif)));

    private async Task<Categorie> FindAsync(int id, CancellationToken ct) =>
        await db.Categories.FirstOrDefaultAsync(c => c.Id == id, ct)
            ?? throw AppException.NotFound("Catégorie introuvable.");

    private async Task EnsureNameAvailableAsync(string nomFr, int? exceptId, CancellationToken ct)
    {
        var lowered = nomFr.ToLower();
        if (await db.Categories.AnyAsync(c => c.Id != exceptId && c.NomFr.ToLower() == lowered, ct))
        {
            throw AppException.Conflict($"Une catégorie nommée « {nomFr} » existe déjà.");
        }
    }
}
