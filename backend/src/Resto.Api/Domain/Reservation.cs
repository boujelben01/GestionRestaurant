namespace Resto.Api.Domain;

public class Reservation
{
    public int Id { get; set; }
    public string? UserId { get; set; }
    public string NomClient { get; set; } = string.Empty;
    public string Telephone { get; set; } = string.Empty;
    public DateTime DateHeure { get; set; }
    public int NombrePersonnes { get; set; }
    public StatutReservation Statut { get; set; } = StatutReservation.EnAttente;
    public string? Note { get; set; }
    public int? TableId { get; set; }
    public DateTime DateCreation { get; set; }

    public ApplicationUser? User { get; set; }
    public RestaurantTable? Table { get; set; }
}
