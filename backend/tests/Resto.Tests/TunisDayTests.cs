using Resto.Api.Features.Commandes.Admin;
using Resto.Api.Features.Restaurant;

namespace Resto.Tests;

public class TunisDayTests
{
    private static DateTimeOffset Utc(string iso) => DateTimeOffset.Parse(iso, null, System.Globalization.DateTimeStyles.AssumeUniversal);

    [Fact]
    public void Midday_in_Tunis_gives_the_local_day_in_utc()
    {
        // Tunis = UTC+1 toute l'année : la journée locale du 1er juin va du 31 mai 23:00Z au 1er juin 23:00Z.
        var (date, start, end) = TunisDay.Bounds(Utc("2024-06-01T10:00:00Z"));

        Assert.Equal(new DateOnly(2024, 6, 1), date);
        Assert.Equal(new DateTime(2024, 5, 31, 23, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2024, 6, 1, 23, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void Just_after_local_midnight_belongs_to_the_next_local_day()
    {
        // 23:30Z le 1er juin = 00:30 le 2 juin à Tunis.
        var (date, start, _) = TunisDay.Bounds(Utc("2024-06-01T23:30:00Z"));

        Assert.Equal(new DateOnly(2024, 6, 2), date);
        Assert.Equal(new DateTime(2024, 6, 1, 23, 0, 0, DateTimeKind.Utc), start);
    }

    [Fact]
    public void Just_before_local_midnight_stays_on_the_same_local_day()
    {
        // 22:59Z = 23:59 à Tunis : toujours le 1er juin.
        var (date, _, end) = TunisDay.Bounds(Utc("2024-06-01T22:59:59Z"));

        Assert.Equal(new DateOnly(2024, 6, 1), date);
        Assert.Equal(new DateTime(2024, 6, 1, 23, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void The_start_is_inclusive_and_the_end_exclusive()
    {
        var (_, start, end) = TunisDay.Bounds(Utc("2024-06-01T23:00:00Z"));

        // 23:00Z = minuit local : on est déjà le 2 juin, la journée précédente se termine (exclue) à cet instant.
        Assert.Equal(new DateTime(2024, 6, 1, 23, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2024, 6, 2, 23, 0, 0, DateTimeKind.Utc), end);
    }

    [Fact]
    public void A_day_is_24_hours_in_Tunis()
    {
        var (_, start, end) = TunisDay.Bounds(Utc("2024-03-31T12:00:00Z"));

        Assert.Equal(TimeSpan.FromHours(24), end - start);
    }

    [Fact]
    public void Bounds_follow_the_daylight_saving_shift_of_another_zone()
    {
        // La logique est générique : on la vérifie sur Paris, où le 31 mars 2024 ne dure que 23 h.
        TimeZoneInfo paris;
        try
        {
            paris = TimeZoneInfo.FindSystemTimeZoneById("Europe/Paris");
        }
        catch (TimeZoneNotFoundException)
        {
            return; // fuseau absent de cette machine : le test n'a pas d'objet
        }

        var (date, start, end) = TunisDay.Bounds(Utc("2024-03-31T12:00:00Z"), paris);

        Assert.Equal(new DateOnly(2024, 3, 31), date);
        Assert.Equal(new DateTime(2024, 3, 30, 23, 0, 0, DateTimeKind.Utc), start);
        Assert.Equal(new DateTime(2024, 3, 31, 22, 0, 0, DateTimeKind.Utc), end);
        Assert.Equal(TimeSpan.FromHours(23), end - start);
    }

    [Fact]
    public void The_default_zone_is_the_restaurant_zone()
    {
        var now = Utc("2024-06-01T10:00:00Z");

        Assert.Equal(TunisDay.Bounds(now), TunisDay.Bounds(now, OpeningHours.TunisZone));
    }
}
