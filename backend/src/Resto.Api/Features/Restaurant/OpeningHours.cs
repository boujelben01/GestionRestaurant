using Resto.Api.Domain;

namespace Resto.Api.Features.Restaurant;

public static class OpeningHours
{
    public static TimeZoneInfo TunisZone { get; } = ResolveTunisZone();

    public static bool IsOpen(IEnumerable<Horaire> horaires, DateTimeOffset nowUtc, TimeZoneInfo? zone = null)
    {
        var local = TimeZoneInfo.ConvertTime(nowUtc, zone ?? TunisZone);
        var time = TimeOnly.FromTimeSpan(local.TimeOfDay);
        var day = (int)local.DayOfWeek;
        var previousDay = (day + 6) % 7;

        var byDay = horaires.ToDictionary(h => h.JourSemaine);
        if (byDay.TryGetValue(day, out var today) && IsOpenToday(today, time))
        {
            return true;
        }

        return byDay.TryGetValue(previousDay, out var yesterday) && IsOpenAfterMidnight(yesterday, time);
    }

    private static bool IsOpenToday(Horaire h, TimeOnly time)
    {
        if (h.EstFerme || h.Ouverture is not { } open || h.Fermeture is not { } close || open == close)
        {
            return false;
        }

        return open < close ? time >= open && time < close : time >= open;
    }

    private static bool IsOpenAfterMidnight(Horaire h, TimeOnly time)
    {
        if (h.EstFerme || h.Ouverture is not { } open || h.Fermeture is not { } close)
        {
            return false;
        }

        return close < open && time < close;
    }

    private static TimeZoneInfo ResolveTunisZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById("Africa/Tunis");
        }
        catch (Exception ex) when (ex is TimeZoneNotFoundException or InvalidTimeZoneException)
        {
            return TimeZoneInfo.CreateCustomTimeZone("Africa/Tunis", TimeSpan.FromHours(1), "Tunis", "Tunis");
        }
    }
}
