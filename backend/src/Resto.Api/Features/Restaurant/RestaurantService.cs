using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Restaurant.Contracts;

namespace Resto.Api.Features.Restaurant;

public class RestaurantService(AppDbContext db, TimeProvider time)
{
    private const string TimeFormat = "HH:mm";

    public async Task<RestaurantResponse> GetAsync(CancellationToken ct)
    {
        var parametres = await db.ParametresRestaurant.AsNoTracking().FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Les paramètres du restaurant ne sont pas initialisés.");
        var horaires = await db.Horaires.AsNoTracking().OrderBy(h => h.JourSemaine).ToListAsync(ct);

        return new RestaurantResponse(
            parametres.Nom,
            parametres.Telephone,
            parametres.Email,
            parametres.Adresse,
            parametres.FraisLivraison,
            parametres.MontantMinimumLivraison,
            parametres.CommandesOuvertes,
            horaires.Select(ToResponse).ToList(),
            OpeningHours.IsOpen(horaires, time.GetUtcNow()));
    }

    public async Task<RestaurantResponse> UpdateAsync(UpdateRestaurantRequest request, CancellationToken ct)
    {
        var parametres = await db.ParametresRestaurant.FirstOrDefaultAsync(ct);
        if (parametres is null)
        {
            parametres = new ParametresRestaurant { Id = 1, CommandesOuvertes = true };
            db.ParametresRestaurant.Add(parametres);
        }

        parametres.Nom = request.Nom.Trim();
        parametres.Telephone = request.Telephone.Trim();
        parametres.Email = request.Email.Trim();
        parametres.Adresse = request.Adresse.Trim();
        parametres.FraisLivraison = request.FraisLivraison;
        parametres.MontantMinimumLivraison = request.MontantMinimumLivraison;

        await db.SaveChangesAsync(ct);
        return await GetAsync(ct);
    }

    public async Task<RestaurantResponse> SetCommandesOuvertesAsync(bool ouvertes, CancellationToken ct)
    {
        var parametres = await db.ParametresRestaurant.FirstOrDefaultAsync(ct)
            ?? throw AppException.NotFound("Les paramètres du restaurant ne sont pas initialisés.");
        parametres.CommandesOuvertes = ouvertes;
        await db.SaveChangesAsync(ct);
        return await GetAsync(ct);
    }

    public async Task<RestaurantResponse> UpdateHorairesAsync(UpdateHorairesRequest request, CancellationToken ct)
    {
        var requested = request.Horaires;
        if (requested.Count != 7 || requested.Select(h => h.JourSemaine).Distinct().Count() != 7)
        {
            throw AppException.Invalid(nameof(request.Horaires), "Il faut exactement un horaire pour chacun des 7 jours (0 à 6).");
        }

        var parsed = new List<(HoraireRequest Request, TimeOnly? Open, TimeOnly? Close)>();
        for (var i = 0; i < requested.Count; i++)
        {
            var h = requested[i];
            if (h.EstFerme)
            {
                parsed.Add((h, null, null));
                continue;
            }

            if (!TimeOnly.TryParseExact(h.Ouverture, TimeFormat, out var open))
            {
                throw AppException.Invalid($"Horaires[{i}].Ouverture", "L'ouverture est requise (HH:mm) pour un jour non fermé.");
            }
            if (!TimeOnly.TryParseExact(h.Fermeture, TimeFormat, out var close))
            {
                throw AppException.Invalid($"Horaires[{i}].Fermeture", "La fermeture est requise (HH:mm) pour un jour non fermé.");
            }
            if (open == close)
            {
                throw AppException.Invalid($"Horaires[{i}].Fermeture", "La fermeture doit différer de l'ouverture.");
            }

            parsed.Add((h, open, close));
        }

        var existing = await db.Horaires.ToDictionaryAsync(h => h.JourSemaine, ct);
        foreach (var (h, open, close) in parsed)
        {
            if (!existing.TryGetValue(h.JourSemaine, out var horaire))
            {
                horaire = new Horaire { JourSemaine = h.JourSemaine };
                db.Horaires.Add(horaire);
            }

            horaire.EstFerme = h.EstFerme;
            horaire.Ouverture = open;
            horaire.Fermeture = close;
        }

        await db.SaveChangesAsync(ct);
        return await GetAsync(ct);
    }

    private static HoraireResponse ToResponse(Horaire h) => new(
        h.JourSemaine,
        h.Ouverture?.ToString(TimeFormat),
        h.Fermeture?.ToString(TimeFormat),
        h.EstFerme);
}
