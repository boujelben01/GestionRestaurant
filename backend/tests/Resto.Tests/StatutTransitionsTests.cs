using Resto.Api.Common;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes;

namespace Resto.Tests;

public class StatutTransitionsTests
{
    private const StatutCommande EnAttente = StatutCommande.EnAttente;
    private const StatutCommande EnPreparation = StatutCommande.EnPreparation;
    private const StatutCommande Prete = StatutCommande.Prete;
    private const StatutCommande Terminee = StatutCommande.Terminee;
    private const StatutCommande Annulee = StatutCommande.Annulee;

    // Table de référence écrite à la main (indépendante de l'implémentation) : les 6 seules transitions valides.
    private static readonly HashSet<(StatutCommande, StatutCommande)> Valid =
    [
        (EnAttente, EnPreparation), (EnAttente, Annulee),
        (EnPreparation, Prete), (EnPreparation, Annulee),
        (Prete, Terminee), (Prete, Annulee)
    ];

    public static TheoryData<StatutCommande, StatutCommande, TransitionKind> AllPairs()
    {
        var data = new TheoryData<StatutCommande, StatutCommande, TransitionKind>();
        foreach (var from in Enum.GetValues<StatutCommande>())
        {
            foreach (var to in Enum.GetValues<StatutCommande>())
            {
                var expected = from == to
                    ? TransitionKind.Unchanged
                    : Valid.Contains((from, to)) ? TransitionKind.Allowed : TransitionKind.Forbidden;
                data.Add(from, to, expected);
            }
        }

        return data;
    }

    [Fact]
    public void The_table_covers_25_pairs_with_5_unchanged_6_allowed_and_14_forbidden()
    {
        var kinds = AllPairs().Select(row => (TransitionKind)row[2]).ToList();

        Assert.Equal(25, kinds.Count);
        Assert.Equal(5, kinds.Count(k => k == TransitionKind.Unchanged));
        Assert.Equal(6, kinds.Count(k => k == TransitionKind.Allowed));
        Assert.Equal(14, kinds.Count(k => k == TransitionKind.Forbidden));
    }

    [Theory]
    [MemberData(nameof(AllPairs))]
    public void Every_pair_is_evaluated_as_expected(StatutCommande from, StatutCommande to, TransitionKind expected)
    {
        Assert.Equal(expected, StatutTransitions.Evaluate(from, to));
        Assert.Equal(expected == TransitionKind.Allowed, StatutTransitions.CanTransition(from, to));
    }

    [Theory]
    [MemberData(nameof(AllPairs))]
    public void EnsureAllowed_throws_a_409_only_for_forbidden_pairs(StatutCommande from, StatutCommande to, TransitionKind expected)
    {
        if (expected == TransitionKind.Forbidden)
        {
            var error = Assert.Throws<AppException>(() => StatutTransitions.EnsureAllowed(from, to));
            Assert.Equal(409, error.Status);
            Assert.Contains($"{from} -> {to} n'est pas autorisé", error.Message);
        }
        else
        {
            StatutTransitions.EnsureAllowed(from, to); // idempotent ou autorisé : aucune exception
        }
    }

    [Fact]
    public void The_message_names_both_statuses()
    {
        var error = Assert.Throws<AppException>(() => StatutTransitions.EnsureAllowed(EnAttente, Terminee));

        Assert.Equal("EnAttente -> Terminee n'est pas autorisé.", error.Message);
    }

    [Theory]
    [InlineData(StatutCommande.Terminee)]
    [InlineData(StatutCommande.Annulee)]
    public void Final_statuses_have_no_way_out(StatutCommande final)
    {
        Assert.True(StatutTransitions.IsFinal(final));
        Assert.Empty(StatutTransitions.NextOf(final));
    }

    [Theory]
    [InlineData(StatutCommande.EnAttente)]
    [InlineData(StatutCommande.EnPreparation)]
    [InlineData(StatutCommande.Prete)]
    public void Non_final_statuses_can_always_be_cancelled(StatutCommande from)
    {
        Assert.False(StatutTransitions.IsFinal(from));
        Assert.Contains(Annulee, StatutTransitions.NextOf(from));
    }

    [Theory]
    [InlineData(StatutCommande.EnAttente, true)]
    [InlineData(StatutCommande.EnPreparation, false)]
    [InlineData(StatutCommande.Prete, false)]
    [InlineData(StatutCommande.Terminee, false)]
    [InlineData(StatutCommande.Annulee, false)]
    public void A_client_can_only_cancel_a_pending_order(StatutCommande from, bool expected)
    {
        Assert.Equal(expected, StatutTransitions.CanClientCancel(from));
    }
}
