using Resto.Api.Domain;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Commandes.Admin;

namespace Resto.Api.Data.Demo;

/// <summary>
/// Générateur pseudo-aléatoire SplitMix64 : déterministe et indépendant de l'implémentation de System.Random,
/// donc stable d'une version du runtime à l'autre pour une même graine.
/// </summary>
public sealed class DemoRandom(long seed)
{
    private ulong _state = unchecked((ulong)seed);

    public ulong NextUInt64()
    {
        unchecked
        {
            var z = _state += 0x9E3779B97F4A7C15UL;
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            return z ^ (z >> 31);
        }
    }

    /// <summary>Entier dans [min, max] (bornes incluses).</summary>
    public int Between(int min, int max) => min + (int)(NextUInt64() % (ulong)(max - min + 1));

    /// <summary>Réel dans [0, 1[.</summary>
    public double NextDouble() => (NextUInt64() >> 11) * (1.0 / (1UL << 53));

    /// <summary>Indice tiré proportionnellement aux poids (tous ≥ 0, somme > 0), dans l'ordre fourni.</summary>
    public int Weighted(IReadOnlyList<int> weights)
    {
        var target = Between(1, weights.Sum());
        for (var i = 0; i < weights.Count; i++)
        {
            target -= weights[i];
            if (target <= 0) return i;
        }
        return weights.Count - 1;
    }
}

// Entrées du générateur, déjà résolues (aucune référence à la base) et triées de façon stable.
public sealed record DemoArticleRef(int Id, string Categorie, string NomFr, decimal Prix, bool Populaire);
public sealed record DemoTableRef(int Id, int Numero);
public sealed record DemoAdresseRef(string Libelle, string Texte, string Telephone);
public sealed record DemoClient(string Cle, string Nom, string Telephone, bool Actif, DateTime DateCreationUtc, IReadOnlyList<DemoAdresseRef> Adresses);
public sealed record DemoRestaurant(decimal FraisLivraison, decimal MinimumLivraison);

public sealed record DemoManualOrder(
    int Index, string ClientCle, TypeCommande Type, DemoTableRef? Table, DemoAdresseRef? Adresse, int IlYaJours, TimeOnly Heure,
    StatutCommande Statut, bool Paye, IReadOnlyList<(DemoArticleRef Article, int Quantite)> Lignes);

public sealed record GeneratedLine(int ArticleId, string NomFr, decimal PrixUnitaire, int Quantite);
public sealed record GeneratedStep(StatutCommande Statut, DateTime Date, bool ParClient);

public sealed record GeneratedOrder(
    string ClientCle, string NomClient, string Telephone, TypeCommande Type, int? TableId, int? TableNumero, string? Adresse,
    StatutCommande Statut, bool EstPayee, DateTime DateCommande, decimal SousTotal, decimal FraisLivraison, decimal Total,
    IReadOnlyList<GeneratedLine> Lignes, IReadOnlyList<GeneratedStep> Historique, bool Manuelle)
{
    public DateTime DateMiseAJour => Historique[^1].Date;
}

public sealed record DemoGeneration(IReadOnlyList<GeneratedOrder> Orders, IReadOnlyList<string> Notices);

/// <summary>
/// Génère les commandes de démonstration. Pur et déterministe : mêmes entrées (dont la graine et l'instant
/// de référence) → mêmes commandes. Les heures sont tirées en heure de Tunis puis stockées en UTC.
/// </summary>
public static class DemoGenerator
{
    // Poids des heures d'ouverture (heure de Tunis, 11 h à 22 h) : pics 12 h-14 h et 19 h-22 h.
    private static readonly (int Heure, int Poids)[] Heures =
        [(11, 2), (12, 7), (13, 7), (14, 3), (15, 1), (16, 1), (17, 1), (18, 2), (19, 6), (20, 7), (21, 6), (22, 2)];

    private const int PoidsPopulaire = 4;
    private const int PoidsNormal = 1;

    public static DemoGeneration Generate(
        DemoReglages reglages,
        IReadOnlyList<DemoClient> clients,
        IReadOnlyList<DemoArticleRef> articles,
        IReadOnlyList<DemoTableRef> tables,
        DemoRestaurant restaurant,
        IReadOnlyList<DemoManualOrder> manuelles,
        DateTimeOffset nowUtc,
        TimeZoneInfo zone)
    {
        var rng = new DemoRandom(reglages.Graine!.Value);
        var now = nowUtc.UtcDateTime;
        var today = TunisDay.Bounds(nowUtc, zone).Date;
        var orders = new List<GeneratedOrder>();
        var notices = new List<string>();

        var sortedClients = clients.OrderBy(c => c.Cle, StringComparer.Ordinal).ToList();
        var fidelite = sortedClients.Select(_ => rng.Between(1, 5)).ToList();
        var sortedArticles = articles.OrderBy(a => a.Id).ToList();
        var sortedTables = tables.OrderBy(t => t.Numero).ToList();
        var types = reglages.RepartitionTypes!
            .Select(kv => (Type: DemoValidator.ParseType(kv.Key)!.Value, Poids: Math.Max(kv.Value, 0)))
            .OrderBy(t => t.Type)
            .ToList();
        var context = new Context(rng, reglages, sortedArticles, sortedTables, restaurant, zone);

        // Historique : du plus ancien jour à aujourd'hui inclus ; aujourd'hui, seules les commandes déjà terminées avant maintenant.
        for (var back = reglages.Jours!.Value - 1; back >= 0; back--)
        {
            var day = today.AddDays(-back);
            var count = DailyCount(rng, reglages.CommandesParJour!, day.DayOfWeek);
            for (var n = 0; n < count; n++)
            {
                var local = day.ToDateTime(PickTime(rng));
                var start = ToUtc(local, zone);
                var client = PickClient(rng, sortedClients, fidelite, start);
                var type = types[rng.Weighted(types.Select(t => t.Poids).ToList())].Type;
                var cancelled = rng.Between(1, 100) <= reglages.PourcentageAnnulees!.Value;
                if (client is null) continue;

                var order = context.Build(client, type, start, cancelled ? StatutCommande.Annulee : StatutCommande.Terminee, paye: !cancelled);
                if (order is not null && order.DateMiseAJour <= now) orders.Add(order);
            }
        }

        AddActiveOrders(context, reglages, sortedClients, fidelite, types.Select(t => t.Type).ToList(), now, orders, notices);

        foreach (var manuelle in manuelles.OrderBy(m => m.Index))
        {
            var client = sortedClients.First(c => c.Cle == manuelle.ClientCle);
            var order = context.BuildManual(client, manuelle, today, now, notices);
            if (order is not null) orders.Add(order);
        }

        return new DemoGeneration(
            orders.OrderBy(o => o.DateCommande).ThenBy(o => o.ClientCle, StringComparer.Ordinal).ToList(), notices);
    }

    private static int DailyCount(DemoRandom rng, DemoIntervalle range, DayOfWeek day)
    {
        var count = (double)rng.Between(range.Min!.Value, range.Max!.Value);
        // Moins de monde le dimanche, plus le week-end (vendredi soir et samedi).
        var factor = day switch
        {
            DayOfWeek.Sunday => 0.6,
            DayOfWeek.Friday => 1.2,
            DayOfWeek.Saturday => 1.3,
            _ => 1.0
        };
        return (int)Math.Round(count * factor, MidpointRounding.AwayFromZero);
    }

    private static TimeOnly PickTime(DemoRandom rng)
    {
        var heure = Heures[rng.Weighted(Heures.Select(h => h.Poids).ToList())].Heure;
        return new TimeOnly(heure, rng.Between(0, 59));
    }

    private static DemoClient? PickClient(DemoRandom rng, List<DemoClient> clients, List<int> fidelite, DateTime atUtc)
    {
        // Clients actifs et déjà inscrits à cette date ; poids de fidélité tirés une fois pour toutes.
        var eligible = Enumerable.Range(0, clients.Count)
            .Where(i => clients[i].Actif && clients[i].DateCreationUtc <= atUtc)
            .ToList();
        if (eligible.Count == 0) return null;
        return clients[eligible[rng.Weighted(eligible.Select(i => fidelite[i]).ToList())]];
    }

    private static void AddActiveOrders(
        Context context, DemoReglages reglages, List<DemoClient> clients, List<int> fidelite, List<TypeCommande> types,
        DateTime now, List<GeneratedOrder> orders, List<string> notices)
    {
        var rng = context.Rng;
        var actives = DemoValidator.StatutsActifs
            .SelectMany(s => Enumerable.Repeat(s, reglages.CommandesActivesAujourdhui!.TryGetValue(s.ToString(), out var n) ? n : 0))
            .ToList();
        if (actives.Count == 0) return;

        // Une commande sur trois (au moins une) sur place, sur des tables différentes autant que possible, pour la vue salle.
        var surPlace = context.Tables.Count == 0 ? 0 : Math.Max(1, actives.Count / 3);
        var freeTables = context.Tables.ToList();
        var skipped = 0;
        for (var i = 0; i < actives.Count; i++)
        {
            var statut = actives[i];
            // Plus le statut est avancé, plus la commande est ancienne (de 5 à 75 minutes avant maintenant).
            var minutes = statut switch
            {
                StatutCommande.EnAttente => rng.Between(5, 20),
                StatutCommande.EnPreparation => rng.Between(20, 45),
                _ => rng.Between(40, 75)
            };
            var start = now.AddMinutes(-minutes);
            var client = PickClient(rng, clients, fidelite, start);
            if (client is null)
            {
                skipped++;
                continue;
            }

            TypeCommande type;
            DemoTableRef? table = null;
            if (i % 3 == 0 && surPlace-- > 0)
            {
                type = TypeCommande.SurPlace;
                var pool = freeTables.Count > 0 ? freeTables : context.Tables;
                table = pool[rng.Between(0, pool.Count - 1)];
                freeTables.Remove(table);
            }
            else
            {
                type = types[rng.Between(0, types.Count - 1)];
                if (type == TypeCommande.SurPlace) type = TypeCommande.ARemporter;
            }

            var order = context.Build(client, type, start, statut, paye: false, table, activeUntil: now);
            if (order is null) skipped++;
            else orders.Add(order);
        }
        if (skipped > 0) notices.Add($"{skipped} commande(s) active(s) non générée(s) (aucun client éligible ou panier impossible).");
    }

    private sealed class Context(
        DemoRandom rng, DemoReglages reglages, List<DemoArticleRef> articles, List<DemoTableRef> tables,
        DemoRestaurant restaurant, TimeZoneInfo zone)
    {
        public DemoRandom Rng => rng;
        public List<DemoTableRef> Tables => tables;

        public GeneratedOrder? Build(
            DemoClient client, TypeCommande type, DateTime start, StatutCommande statut, bool paye,
            DemoTableRef? table = null, DateTime? activeUntil = null)
        {
            DemoAdresseRef? adresse = null;
            if (type == TypeCommande.SurPlace && table is null)
            {
                if (tables.Count == 0) type = TypeCommande.ARemporter;
                else table = tables[rng.Between(0, tables.Count - 1)];
            }
            if (type == TypeCommande.Livraison)
            {
                if (client.Adresses.Count == 0) type = TypeCommande.ARemporter;
                else adresse = client.Adresses[rng.Between(0, client.Adresses.Count - 1)];
            }

            var lignes = PickLines(type);
            if (lignes is null && type == TypeCommande.Livraison)
            {
                // Minimum de livraison inatteignable avec ce catalogue : la commande devient « à emporter ».
                type = TypeCommande.ARemporter;
                adresse = null;
                lignes = PickLines(type);
            }
            if (lignes is null) return null;

            var historique = activeUntil is { } until
                ? ActiveHistory(statut, start, until)
                : PastHistory(statut, start, type);
            return Assemble(client, type, table, adresse, statut, paye, start, lignes, historique, manuelle: false);
        }

        public GeneratedOrder? BuildManual(DemoClient client, DemoManualOrder m, DateOnly today, DateTime now, List<string> notices)
        {
            var start = ToUtc(today.AddDays(-m.IlYaJours).ToDateTime(m.Heure), zone);
            List<GeneratedStep> historique;
            if (DemoValidator.StatutsActifs.Contains(m.Statut))
            {
                var latest = now.AddMinutes(-10);
                if (start > latest)
                {
                    notices.Add($"Commande manuelle n°{m.Index + 1} : {m.Heure:HH\\:mm} est dans le futur, ramenée à 10 minutes avant maintenant.");
                    start = latest;
                }
                historique = ActiveHistory(m.Statut, start, now);
            }
            else
            {
                historique = PastHistory(m.Statut, start, m.Type);
            }

            var lignes = m.Lignes.Select(l => new GeneratedLine(l.Article.Id, l.Article.NomFr, l.Article.Prix, l.Quantite)).ToList();
            return Assemble(client, m.Type, m.Table, m.Adresse, m.Statut, m.Paye, start, lignes, historique, manuelle: true);
        }

        private GeneratedOrder Assemble(
            DemoClient client, TypeCommande type, DemoTableRef? table, DemoAdresseRef? adresse, StatutCommande statut, bool paye,
            DateTime start, List<GeneratedLine> lignes, List<GeneratedStep> historique, bool manuelle)
        {
            // Même calcul que CommandeService (lève si le minimum de livraison n'est pas atteint).
            var totals = CommandeRules.ComputeTotals(
                lignes.Select(l => (l.PrixUnitaire, l.Quantite)), type, restaurant.FraisLivraison, restaurant.MinimumLivraison);
            return new GeneratedOrder(
                client.Cle, client.Nom, adresse?.Telephone ?? client.Telephone, type,
                type == TypeCommande.SurPlace ? table?.Id : null,
                type == TypeCommande.SurPlace ? table?.Numero : null,
                type == TypeCommande.Livraison ? adresse?.Texte : null,
                statut, paye && statut != StatutCommande.Annulee, start,
                totals.SousTotal, totals.FraisLivraison, totals.Total, lignes, historique, manuelle);
        }

        // Articles tirés sans doublon (populaires plus fréquents), quantités 1..quantiteMax. Pour une livraison,
        // on complète jusqu'au minimum ; null si c'est impossible.
        private List<GeneratedLine>? PickLines(TypeCommande type)
        {
            var range = reglages.LignesParCommande!;
            var quantiteMax = reglages.QuantiteMax!.Value;
            var pool = articles.ToList();
            var lignes = new List<GeneratedLine>();
            var count = Math.Min(rng.Between(range.Min!.Value, range.Max!.Value), pool.Count);
            for (var i = 0; i < count; i++) lignes.Add(Take(pool, rng.Between(1, quantiteMax)));

            if (type != TypeCommande.Livraison) return lignes;

            while (lignes.Sum(l => CommandeRules.Round(l.PrixUnitaire * l.Quantite)) < restaurant.MinimumLivraison)
            {
                var index = lignes.FindIndex(l => l.Quantite < quantiteMax);
                if (index >= 0) lignes[index] = lignes[index] with { Quantite = lignes[index].Quantite + 1 };
                else if (pool.Count > 0 && lignes.Count < DemoValidator.LignesMax) lignes.Add(Take(pool, 1));
                else return null;
            }
            return lignes;
        }

        private GeneratedLine Take(List<DemoArticleRef> pool, int quantite)
        {
            var article = pool[rng.Weighted(pool.Select(a => a.Populaire ? PoidsPopulaire : PoidsNormal).ToList())];
            pool.Remove(article);
            return new GeneratedLine(article.Id, article.NomFr, article.Prix, quantite);
        }

        // Historique d'une commande passée : transitions valides (StatutTransitions), horodatages strictement croissants.
        private List<GeneratedStep> PastHistory(StatutCommande final, DateTime start, TypeCommande type)
        {
            var steps = new List<GeneratedStep> { new(StatutCommande.EnAttente, start, ParClient: true) };
            var t = start;
            if (final == StatutCommande.Annulee)
            {
                // Annulée par le client tant qu'elle est en attente, ou par le restaurant pendant la préparation.
                if (rng.Between(1, 100) <= 60)
                {
                    steps.Add(new(StatutCommande.Annulee, t = t.AddMinutes(rng.Between(1, 10)), ParClient: true));
                    return Checked(steps);
                }
                steps.Add(new(StatutCommande.EnPreparation, t = t.AddMinutes(rng.Between(1, 6)), false));
                steps.Add(new(StatutCommande.Annulee, t.AddMinutes(rng.Between(3, 15)), false));
                return Checked(steps);
            }

            steps.Add(new(StatutCommande.EnPreparation, t = t.AddMinutes(rng.Between(1, 6)), false));
            steps.Add(new(StatutCommande.Prete, t = t.AddMinutes(rng.Between(8, 25)), false));
            var fin = type == TypeCommande.SurPlace ? rng.Between(20, 50) : rng.Between(3, 20);
            steps.Add(new(StatutCommande.Terminee, t.AddMinutes(fin), false));
            return Checked(steps);
        }

        // Historique d'une commande active : étapes réparties entre le début et maintenant, jamais dans le futur.
        private static List<GeneratedStep> ActiveHistory(StatutCommande final, DateTime start, DateTime now)
        {
            var chain = new List<StatutCommande> { StatutCommande.EnAttente };
            if (final is StatutCommande.EnPreparation or StatutCommande.Prete) chain.Add(StatutCommande.EnPreparation);
            if (final == StatutCommande.Prete) chain.Add(StatutCommande.Prete);

            var span = now - start;
            var steps = chain.Select((s, i) => new GeneratedStep(
                s, start + TimeSpan.FromTicks(span.Ticks * i / (chain.Count + 1)), ParClient: i == 0)).ToList();
            return Checked(steps);
        }

        private static List<GeneratedStep> Checked(List<GeneratedStep> steps)
        {
            for (var i = 1; i < steps.Count; i++)
            {
                if (!StatutTransitions.CanTransition(steps[i - 1].Statut, steps[i].Statut) || steps[i].Date <= steps[i - 1].Date)
                {
                    throw new InvalidOperationException($"Historique de démonstration incohérent : {steps[i - 1].Statut} → {steps[i].Statut}.");
                }
            }
            return steps;
        }
    }

    public static DateTime ToUtc(DateTime local, TimeZoneInfo zone)
    {
        local = DateTime.SpecifyKind(local, DateTimeKind.Unspecified);
        while (zone.IsInvalidTime(local)) local = local.AddMinutes(1);
        return TimeZoneInfo.ConvertTimeToUtc(local, zone);
    }
}
