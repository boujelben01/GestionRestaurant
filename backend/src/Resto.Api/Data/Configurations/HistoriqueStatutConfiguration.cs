using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class HistoriqueStatutConfiguration : IEntityTypeConfiguration<HistoriqueStatut>
{
    public void Configure(EntityTypeBuilder<HistoriqueStatut> builder)
    {
        builder.ToTable("HistoriqueStatuts", t =>
            t.HasCheckConstraint("CK_HistoriqueStatuts_Statut", EnumSql.InList<StatutCommande>("Statut")));
        builder.Property(h => h.Statut).HasConversion<string>().HasMaxLength(20);
        builder.Property(h => h.Date).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.HasIndex(h => h.CommandeId);
        builder.HasOne(h => h.Commande).WithMany(c => c.Historique).HasForeignKey(h => h.CommandeId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(h => h.ParUser).WithMany().HasForeignKey(h => h.ParUserId).OnDelete(DeleteBehavior.SetNull);
    }
}
