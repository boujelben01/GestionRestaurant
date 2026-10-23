using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class AdresseConfiguration : IEntityTypeConfiguration<Adresse>
{
    public void Configure(EntityTypeBuilder<Adresse> builder)
    {
        builder.ToTable("Adresses");
        builder.Property(a => a.UserId).IsRequired();
        builder.Property(a => a.Libelle).HasMaxLength(50).IsRequired();
        builder.Property(a => a.Ligne).HasMaxLength(200).IsRequired();
        builder.Property(a => a.Ville).HasMaxLength(100).IsRequired();
        builder.Property(a => a.Details).HasMaxLength(300);
        builder.Property(a => a.Telephone).HasMaxLength(20).IsRequired();
        builder.HasIndex(a => a.UserId);
        builder.HasOne(a => a.User).WithMany().HasForeignKey(a => a.UserId).OnDelete(DeleteBehavior.Cascade);
    }
}
