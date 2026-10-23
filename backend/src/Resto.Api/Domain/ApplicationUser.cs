using Microsoft.AspNetCore.Identity;

namespace Resto.Api.Domain;

public class ApplicationUser : IdentityUser
{
    public string? Nom { get; set; }
    public DateTime DateCreation { get; set; }
    public string LangueFavorite { get; set; } = "fr";
    public bool EstActif { get; set; } = true;
}
