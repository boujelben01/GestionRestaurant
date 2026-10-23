using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class CommandeConfiguration : IEntityTypeConfiguration<Commande>
{
    public void Configure(EntityTypeBuilder<Commande> builder)
    {
        builder.ToTable("Commandes", t =>
        {
            t.HasCheckConstraint("CK_Commandes_Total", "\"Total\" = \"SousTotal\" + \"FraisLivraison\"");
            t.HasCheckConstraint("CK_Commandes_Statut", EnumSql.InList<StatutCommande>("Statut"));
            t.HasCheckConstraint("CK_Commandes_TypeCommande", EnumSql.InList<TypeCommande>("TypeCommande"));
            t.HasCheckConstraint("CK_Commandes_Livraison_Adresse",
                "\"TypeCommande\" <> 'Livraison' OR \"AdresseLivraison\" IS NOT NULL");
            t.HasCheckConstraint("CK_Commandes_SurPlace_Table",
                "\"TypeCommande\" <> 'SurPlace' OR \"TableId\" IS NOT NULL");
        });

        builder.Property(c => c.Numero).HasMaxLength(20).IsRequired();
        builder.Property(c => c.NomClient).HasMaxLength(100).IsRequired();
        builder.Property(c => c.Telephone).HasMaxLength(20).IsRequired();
        builder.Property(c => c.Statut).HasConversion<string>().HasMaxLength(20);
        builder.Property(c => c.TypeCommande).HasConversion<string>().HasMaxLength(20);
        builder.Property(c => c.ModePaiement).HasConversion<string>().HasMaxLength(20);
        builder.Property(c => c.SousTotal).HasColumnType("numeric(10,2)");
        builder.Property(c => c.FraisLivraison).HasColumnType("numeric(10,2)");
        builder.Property(c => c.Total).HasColumnType("numeric(10,2)");
        builder.Property(c => c.AdresseLivraison).HasMaxLength(500);
        builder.Property(c => c.Note).HasMaxLength(500);
        builder.Property(c => c.DateCommande).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.Property(c => c.DateMiseAJour).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.Property(c => c.Version).HasColumnName("xmin").HasColumnType("xid")
            .ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();

        builder.HasIndex(c => c.Numero).IsUnique();
        builder.HasIndex(c => c.UserId);
        builder.HasIndex(c => new { c.Statut, c.DateCommande });

        builder.HasOne(c => c.User).WithMany().HasForeignKey(c => c.UserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(c => c.Table).WithMany().HasForeignKey(c => c.TableId).OnDelete(DeleteBehavior.SetNull);
    }
}
