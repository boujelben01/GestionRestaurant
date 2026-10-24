using Resto.Api.Features.Restaurant;

namespace Resto.Api.Features.Commandes.Admin;

/// <summary>Bornes UTC de la journée civile du restaurant (fuseau Africa/Tunis).</summary>
public static class TunisDay
{
    /// <summary>
    /// Retourne [début, fin[ de la journée locale contenant <paramref name="nowUtc"/>, exprimés en UTC,
    /// ainsi que la date locale. Le début est inclus, la fin (minuit suivant) est exclue.
    /// </summary>
    public static (DateOnly Date, DateTime StartUtc, DateTime EndUtc) Bounds(DateTimeOffset nowUtc, TimeZoneInfo? zone = null)
    {
        zone ??= OpeningHours.TunisZone;
        var local = TimeZoneInfo.ConvertTime(nowUtc, zone);
        var date = DateOnly.FromDateTime(local.DateTime);
        return (date, MidnightUtc(date, zone), MidnightUtc(date.AddDays(1), zone));
    }

    /// <summary>Minuit local (début de la journée civile) de <paramref name="date"/>, exprimé en UTC.</summary>
    public static DateTime StartOfDayUtc(DateOnly date, TimeZoneInfo? zone = null) =>
        MidnightUtc(date, zone ?? OpeningHours.TunisZone);

    private static DateTime MidnightUtc(DateOnly date, TimeZoneInfo zone)
    {
        var midnight = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Unspecified);
        // Minuit peut ne pas exister (passage à l'heure d'été) : on prend alors le premier instant valide.
        while (zone.IsInvalidTime(midnight))
        {
            midnight = midnight.AddMinutes(1);
        }

        return TimeZoneInfo.ConvertTimeToUtc(midnight, zone);
    }
}
