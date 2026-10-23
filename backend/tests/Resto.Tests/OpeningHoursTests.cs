using Resto.Api.Domain;
using Resto.Api.Features.Restaurant;

namespace Resto.Tests;

public class OpeningHoursTests
{
    // 2030-01-06 est un dimanche (JourSemaine 0), 2030-01-04 un vendredi (5), 2030-01-03 un jeudi (4).
    private static DateTimeOffset Utc(int day, int hour, int minute) =>
        new(2030, 1, day, hour, minute, 0, TimeSpan.Zero);

    private static Horaire H(int jour, string? open = "11:00", string? close = "23:00", bool ferme = false) => new()
    {
        JourSemaine = jour,
        Ouverture = open is null ? null : TimeOnly.Parse(open),
        Fermeture = close is null ? null : TimeOnly.Parse(close),
        EstFerme = ferme
    };

    private static List<Horaire> Week(params Horaire[] overrides)
    {
        var week = Enumerable.Range(0, 7).Select(d => H(d)).ToList();
        foreach (var o in overrides)
        {
            week[o.JourSemaine] = o;
        }
        return week;
    }

    [Fact]
    public void Tunis_zone_is_utc_plus_one() =>
        Assert.Equal(TimeSpan.FromHours(1), OpeningHours.TunisZone.GetUtcOffset(Utc(3, 12, 0)));

    [Theory]
    [InlineData(9, 59, false)]
    [InlineData(10, 0, true)]
    [InlineData(21, 59, true)]
    [InlineData(22, 0, false)]
    public void Opening_boundaries_use_tunis_time_and_exclusive_closing(int utcHour, int utcMinute, bool expected) =>
        Assert.Equal(expected, OpeningHours.IsOpen(Week(), Utc(3, utcHour, utcMinute)));

    [Theory]
    [InlineData(4, 16, 59, false)]
    [InlineData(4, 17, 0, true)]
    [InlineData(4, 22, 59, true)]
    [InlineData(4, 23, 30, true)]
    [InlineData(5, 0, 59, true)]
    [InlineData(5, 1, 0, false)]
    public void Overnight_hours_span_midnight(int utcDay, int utcHour, int utcMinute, bool expected)
    {
        var week = Week(H(5, "18:00", "02:00"));

        Assert.Equal(expected, OpeningHours.IsOpen(week, Utc(utcDay, utcHour, utcMinute)));
    }

    [Fact]
    public void Closed_day_is_never_open()
    {
        var week = Week(H(0, null, null, ferme: true));

        Assert.False(OpeningHours.IsOpen(week, Utc(6, 11, 0)));
    }

    [Fact]
    public void Closed_flag_overrides_overnight_spill_from_previous_day()
    {
        var week = Week(H(4, "18:00", "02:00", ferme: true));

        Assert.False(OpeningHours.IsOpen(week, Utc(3, 23, 30)));
    }

    [Fact]
    public void Timezone_shifts_the_day_after_utc_evening()
    {
        // Jeudi 23:30 UTC = vendredi 00:30 à Tunis : c'est l'horaire du vendredi qui s'applique.
        var week = Week(H(5, "00:15", "06:00"));

        Assert.True(OpeningHours.IsOpen(week, Utc(3, 23, 30)));
    }

    [Fact]
    public void Missing_or_empty_hours_mean_closed()
    {
        Assert.False(OpeningHours.IsOpen([], Utc(3, 12, 0)));
        Assert.False(OpeningHours.IsOpen(Week(H(4, "11:00", "11:00")), Utc(3, 11, 0)));
    }
}
