using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using resto.Models;

namespace resto.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Categorie> Categories { get; set; }
        public DbSet<Article> Articles { get; set; }
        public DbSet<Panier> Paniers { get; set; }
        public DbSet<PanierItem> PanierItems { get; set; }
        public DbSet<Commande> Commandes { get; set; }
        public DbSet<CommandeItem> CommandeItems { get; set; }

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder);

            builder.Entity<ApplicationUser>(e =>
            {
                e.Property(u => u.Nom).HasMaxLength(100);
                e.Property(u => u.DateCreation).HasColumnType("timestamp with time zone");
                e.HasIndex(u => u.NormalizedEmail)
                    .IsUnique()
                    .HasFilter("\"NormalizedEmail\" IS NOT NULL")
                    .HasDatabaseName("EmailUniqueIndex");
            });

            builder.Entity<Categorie>(e =>
            {
                e.ToTable("Categories");
                e.Property(c => c.Nom).IsRequired().HasMaxLength(100);
                e.Property(c => c.EstActive).HasDefaultValue(true);
                e.HasIndex(c => c.Nom).IsUnique();
            });

            builder.Entity<Article>(e =>
            {
                e.ToTable("Articles", t => t.HasCheckConstraint("CK_Articles_Prix", "\"Prix\" >= 0"));
                e.Property(a => a.Nom).IsRequired().HasMaxLength(150);
                e.Property(a => a.Description).HasMaxLength(1000);
                e.Property(a => a.Prix).HasColumnType("numeric(10,2)");
                e.Property(a => a.ImageUrl).HasMaxLength(500);
                e.Property(a => a.EstDisponible).HasDefaultValue(true);
                e.HasOne(a => a.Categorie)
                    .WithMany(c => c.Articles)
                    .HasForeignKey(a => a.CategorieId)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            builder.Entity<Panier>(e =>
            {
                e.ToTable("Paniers");
                e.Property(p => p.UserId).IsRequired().HasMaxLength(450);
                e.Property(p => p.DateCreation).HasColumnType("timestamp with time zone");
                e.Property(p => p.DateMiseAJour).HasColumnType("timestamp with time zone");
                e.HasIndex(p => p.UserId).IsUnique();
                e.HasOne(p => p.User)
                    .WithMany()
                    .HasForeignKey(p => p.UserId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<PanierItem>(e =>
            {
                e.ToTable("PanierItems", t => t.HasCheckConstraint("CK_PanierItems_Quantite", "\"Quantite\" > 0"));
                e.HasIndex(i => new { i.PanierId, i.ArticleId }).IsUnique();
                e.HasOne(i => i.Panier)
                    .WithMany(p => p.Items)
                    .HasForeignKey(i => i.PanierId)
                    .OnDelete(DeleteBehavior.Cascade);
                e.HasOne(i => i.Article)
                    .WithMany()
                    .HasForeignKey(i => i.ArticleId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            builder.Entity<Commande>(e =>
            {
                e.ToTable("Commandes", t => t.HasCheckConstraint("CK_Commandes_Total", "\"Total\" >= 0"));
                e.Property(c => c.NomClient).IsRequired().HasMaxLength(256);
                e.Property(c => c.Statut)
                    .HasConversion<string>()
                    .HasMaxLength(20)
                    .HasDefaultValue(StatutCommande.EnAttente);
                e.Property(c => c.TypeCommande).HasConversion<string>().HasMaxLength(20);
                e.Property(c => c.Total).HasColumnType("numeric(10,2)");
                e.Property(c => c.DateCommande).HasColumnType("timestamp with time zone");
                e.Property(c => c.Note).HasMaxLength(500);
                e.HasIndex(c => new { c.UserId, c.DateCommande });
                e.HasIndex(c => c.Statut);
                e.HasOne(c => c.User)
                    .WithMany()
                    .HasForeignKey(c => c.UserId)
                    .OnDelete(DeleteBehavior.SetNull);
            });

            builder.Entity<CommandeItem>(e =>
            {
                e.ToTable("CommandeItems", t => t.HasCheckConstraint("CK_CommandeItems_Quantite", "\"Quantite\" > 0"));
                e.Property(i => i.NomArticle).IsRequired().HasMaxLength(150);
                e.Property(i => i.PrixUnitaire).HasColumnType("numeric(10,2)");
                e.HasOne(i => i.Commande)
                    .WithMany(c => c.Items)
                    .HasForeignKey(i => i.CommandeId)
                    .OnDelete(DeleteBehavior.Cascade);
                e.HasOne(i => i.Article)
                    .WithMany()
                    .HasForeignKey(i => i.ArticleId)
                    .OnDelete(DeleteBehavior.SetNull);
            });
        }
    }
}
