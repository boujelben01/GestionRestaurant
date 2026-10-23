using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Resto.Api.Domain;

namespace Resto.Api.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<ApplicationUser>(options)
{
    public DbSet<Categorie> Categories => Set<Categorie>();
    public DbSet<Article> Articles => Set<Article>();
    public DbSet<Panier> Paniers => Set<Panier>();
    public DbSet<PanierItem> PanierItems => Set<PanierItem>();
    public DbSet<RestaurantTable> Tables => Set<RestaurantTable>();
    public DbSet<Adresse> Adresses => Set<Adresse>();
    public DbSet<Commande> Commandes => Set<Commande>();
    public DbSet<CommandeItem> CommandeItems => Set<CommandeItem>();
    public DbSet<HistoriqueStatut> HistoriqueStatuts => Set<HistoriqueStatut>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<Favori> Favoris => Set<Favori>();
    public DbSet<Horaire> Horaires => Set<Horaire>();
    public DbSet<ParametresRestaurant> ParametresRestaurant => Set<ParametresRestaurant>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
