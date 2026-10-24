using System.Globalization;
using Resto.Api.Common;
using Resto.Api.Features.Commandes.Admin;

namespace Resto.Api.Features.Statistiques;

/// <summary>Période de statistiques en jours civils du restaurant (Africa/Tunis), bornes incluses.</summary>
public readonly record struct StatsPeriod(DateOnly Du, DateOnly Au)
{
    public const int DefaultDays = 30;
    public const int MaxDays = 366;

    public int Days => Au.DayNumber - Du.DayNumber + 1;

    /// <summary>Période de même durée qui précède immédiatement celle-ci.</summary>
    public StatsPeriod Previous => new(Du.AddDays(-Days), Du.AddDays(-1));

    /// <summary>Début (minuit de Tunis, en UTC), inclus.</summary>
    public DateTime StartUtc(TimeZoneInfo? zone = null) => TunisDay.StartOfDayUtc(Du, zone);

    /// <summary>Fin EXCLUE : minuit de Tunis du lendemain du dernier jour, en UTC.</summary>
    public DateTime EndUtcExclusive(TimeZoneInfo? zone = null) => TunisDay.StartOfDayUtc(Au.AddDays(1), zone);

    public bool Contains(DateOnly day) => day >= Du && day <= Au;

    /// <summary>
    /// Résout les paramètres `du` / `au` (AAAA-MM-JJ). Défaut : les 30 derniers jours, aujourd'hui inclus.
    /// Seul `du` : jusqu'à aujourd'hui ; seul `au` : les 30 jours qui précèdent. Toute valeur invalide, `du`
    /// après `au` ou plus de 366 jours donne un 400.
    /// </summary>
    public static StatsPeriod Resolve(string? du, string? au, DateOnly today)
    {
        var from = Parse(du, "du");
        var to = Parse(au, "au");

        if (from is null && to is null)
        {
            return new StatsPeriod(today.AddDays(1 - DefaultDays), today);
        }

        var end = to ?? today;
        var start = from ?? end.AddDays(1 - DefaultDays);
        if (start > end)
        {
            throw AppException.Invalid("du", "La date de début doit précéder la date de fin.");
        }

        var period = new StatsPeriod(start, end);
        if (period.Days > MaxDays)
        {
            throw AppException.Invalid("au", $"La période ne peut pas dépasser {MaxDays} jours.");
        }

        return period;
    }

    private static DateOnly? Parse(string? value, string field)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        if (DateOnly.TryParseExact(value.Trim(), "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var day))
        {
            return day;
        }

        throw AppException.Invalid(field, "Date invalide : utilisez le format AAAA-MM-JJ.");
    }
}
