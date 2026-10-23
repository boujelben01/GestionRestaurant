using Microsoft.AspNetCore.Identity;

namespace resto.Models
{
    public class ApplicationUser : IdentityUser
    {
        public string? Nom { get; set; }
        public DateTime DateCreation { get; set; } = DateTime.UtcNow;
    }
}
