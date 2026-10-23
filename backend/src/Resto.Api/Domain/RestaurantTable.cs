namespace Resto.Api.Domain;

public class RestaurantTable
{
    public int Id { get; set; }
    public int Numero { get; set; }
    public Guid Code { get; set; }
    public int Capacite { get; set; }
    public bool EstActive { get; set; } = true;
}
