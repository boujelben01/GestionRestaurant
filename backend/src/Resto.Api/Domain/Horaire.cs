namespace Resto.Api.Domain;

public class Horaire
{
    public int Id { get; set; }
    public int JourSemaine { get; set; }
    public TimeOnly? Ouverture { get; set; }
    public TimeOnly? Fermeture { get; set; }
    public bool EstFerme { get; set; }
}
