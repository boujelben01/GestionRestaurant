using Resto.Api.Domain;
using Resto.Api.Features.Tables;

namespace Resto.Tests;

public class SalleRulesTests
{
    private static (StatutCommande, bool) O(StatutCommande statut, bool paid = false) => (statut, paid);

    [Fact]
    public void A_table_without_any_tracked_order_is_free()
    {
        Assert.Equal(EtatTable.Libre, SalleService.ComputeEtat(true, []));
    }

    [Theory]
    [InlineData(StatutCommande.EnAttente)]
    [InlineData(StatutCommande.EnPreparation)]
    [InlineData(StatutCommande.Prete)]
    public void An_order_in_progress_makes_the_table_occupied_whether_paid_or_not(StatutCommande statut)
    {
        Assert.Equal(EtatTable.Occupee, SalleService.ComputeEtat(true, [O(statut)]));
        Assert.Equal(EtatTable.Occupee, SalleService.ComputeEtat(true, [O(statut, paid: true)]));
    }

    [Fact]
    public void A_finished_unpaid_order_means_the_table_is_waiting_for_payment()
    {
        Assert.Equal(EtatTable.AEncaisser, SalleService.ComputeEtat(true, [O(StatutCommande.Terminee)]));
    }

    [Fact]
    public void In_progress_wins_over_payment_due()
    {
        // Une commande terminée non payée ET une commande en cours : la table est occupée.
        Assert.Equal(EtatTable.Occupee, SalleService.ComputeEtat(true, [O(StatutCommande.Terminee), O(StatutCommande.EnPreparation)]));
    }

    [Fact]
    public void An_inactive_table_is_inactive_whatever_its_orders()
    {
        Assert.Equal(EtatTable.Inactive, SalleService.ComputeEtat(false, []));
        Assert.Equal(EtatTable.Inactive, SalleService.ComputeEtat(false, [O(StatutCommande.EnAttente)]));
        Assert.Equal(EtatTable.Inactive, SalleService.ComputeEtat(false, [O(StatutCommande.Terminee)]));
    }

    [Theory]
    [InlineData(StatutCommande.EnAttente, false, true)]
    [InlineData(StatutCommande.EnAttente, true, true)]
    [InlineData(StatutCommande.EnPreparation, false, true)]
    [InlineData(StatutCommande.Prete, true, true)]
    [InlineData(StatutCommande.Terminee, false, true)]   // à encaisser : suivie
    [InlineData(StatutCommande.Terminee, true, false)]   // terminée ET payée : sort de la salle
    [InlineData(StatutCommande.Annulee, false, false)]
    [InlineData(StatutCommande.Annulee, true, false)]
    public void Only_orders_that_are_not_cancelled_nor_finished_and_paid_are_tracked(StatutCommande statut, bool paid, bool tracked)
    {
        Assert.Equal(tracked, SalleService.IsTracked(statut, paid));
    }
}
