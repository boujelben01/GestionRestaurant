using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class PanierConfiguration : IEntityTypeConfiguration<Panier>
{
    public void Configure(EntityTypeBuilder<Panier> builder)
    {
        builder.ToTable("Paniers");
        builder.Property(p => p.UserId).IsRequired();
        builder.Property(p => p.DateMiseAJour).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.HasIndex(p => p.UserId).IsUnique();
        builder.HasOne(p => p.User).WithMany().HasForeignKey(p => p.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
