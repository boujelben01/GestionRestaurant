using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Api.Features.Adresses;

/// <summary>
/// Carnet d'adresses du client connecté. L'identité vient toujours du jeton ; l'adresse d'un autre utilisateur
/// est « introuvable » (404, jamais 403 : on ne révèle pas qu'elle existe).
/// Invariants : 10 adresses au plus ; UNE seule adresse par défaut (la première créée l'est automatiquement ;
/// si on supprime la défaut, la plus ancienne devient défaut). Limites connues, faute de contrainte SQL (pas de
/// migration) : deux requêtes simultanées du même utilisateur pourraient dépasser 10 adresses ou créer deux
/// défauts ; l'affichage reste cohérent (la liste place la défaut en premier, puis par ancienneté).
/// </summary>
public class AdresseService(AppDbContext db)
{
    // Requête isolée pour SqlTranslationTests : filtre et tri avant projection.
    internal static IQueryable<Adresse> ListQuery(AppDbContext db, string userId) =>
        db.Adresses.AsNoTracking()
            .Where(a => a.UserId == userId)
            .OrderByDescending(a => a.EstParDefaut).ThenBy(a => a.Id);

    public async Task<IReadOnlyList<AdresseResponse>> ListAsync(string userId, CancellationToken ct) =>
        (await ListQuery(db, userId).ToListAsync(ct)).Select(ToResponse).ToList();

    public async Task<AdresseResponse> CreateAsync(string userId, AdresseRequest request, CancellationToken ct)
    {
        var existing = await db.Adresses.Where(a => a.UserId == userId).ToListAsync(ct);
        if (existing.Count >= AdresseRules.MaxParUtilisateur)
        {
            throw AppException.Conflict($"Vous ne pouvez pas enregistrer plus de {AdresseRules.MaxParUtilisateur} adresses.");
        }

        var adresse = new Adresse { UserId = userId };
        Apply(adresse, request);
        // La première adresse est automatiquement la défaut ; sinon, seulement si on le demande.
        adresse.EstParDefaut = existing.Count == 0 || request.EstParDefaut;
        if (adresse.EstParDefaut)
        {
            existing.ForEach(a => a.EstParDefaut = false);
        }

        db.Adresses.Add(adresse);
        await db.SaveChangesAsync(ct);
        return ToResponse(adresse);
    }

    public async Task<AdresseResponse> UpdateAsync(string userId, int id, AdresseRequest request, CancellationToken ct)
    {
        var all = await db.Adresses.Where(a => a.UserId == userId).ToListAsync(ct);
        var adresse = all.FirstOrDefault(a => a.Id == id) ?? throw AppException.NotFound("Adresse introuvable.");

        Apply(adresse, request);
        // On ne peut pas « dé-défaut » l'adresse par défaut en la modifiant (il n'y aurait plus de défaut) :
        // pour changer de défaut, on désigne une autre adresse (PATCH .../defaut).
        if (request.EstParDefaut && !adresse.EstParDefaut)
        {
            all.ForEach(a => a.EstParDefaut = a.Id == id);
        }

        await db.SaveChangesAsync(ct);
        return ToResponse(adresse);
    }

    /// <summary>Suppression réelle (donnée personnelle). Si c'était la défaut, la plus ancienne restante la devient.</summary>
    public async Task DeleteAsync(string userId, int id, CancellationToken ct)
    {
        var all = await db.Adresses.Where(a => a.UserId == userId).ToListAsync(ct);
        var adresse = all.FirstOrDefault(a => a.Id == id) ?? throw AppException.NotFound("Adresse introuvable.");

        db.Adresses.Remove(adresse);
        if (adresse.EstParDefaut)
        {
            var oldest = all.Where(a => a.Id != id).OrderBy(a => a.Id).FirstOrDefault();
            if (oldest is not null)
            {
                oldest.EstParDefaut = true;
            }
        }

        await db.SaveChangesAsync(ct);
    }

    /// <summary>Désigne la défaut (idempotent) : toutes les autres adresses de l'utilisateur la perdent.</summary>
    public async Task<AdresseResponse> SetDefaultAsync(string userId, int id, CancellationToken ct)
    {
        var all = await db.Adresses.Where(a => a.UserId == userId).ToListAsync(ct);
        var adresse = all.FirstOrDefault(a => a.Id == id) ?? throw AppException.NotFound("Adresse introuvable.");

        if (!adresse.EstParDefaut || all.Count(a => a.EstParDefaut) > 1)
        {
            all.ForEach(a => a.EstParDefaut = a.Id == id);
            await db.SaveChangesAsync(ct);
        }

        return ToResponse(adresse);
    }

    private static void Apply(Adresse adresse, AdresseRequest request)
    {
        adresse.Libelle = request.Libelle.Trim();
        adresse.Ligne = request.Ligne.Trim();
        adresse.Ville = request.Ville.Trim();
        adresse.Telephone = request.Telephone.Trim();
        adresse.Details = string.IsNullOrWhiteSpace(request.Details) ? null : request.Details.Trim();
    }

    private static AdresseResponse ToResponse(Adresse a) =>
        new(a.Id, a.Libelle, a.Ligne, a.Ville, a.Details, a.Telephone, a.EstParDefaut);
}
