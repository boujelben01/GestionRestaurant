using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class ParametresRestaurantConfiguration : IEntityTypeConfiguration<ParametresRestaurant>
{
    public void Configure(EntityTypeBuilder<ParametresRestaurant> builder)
    {
        builder.ToTable("ParametresRestaurant", t => t.HasCheckConstraint("CK_ParametresRestaurant_Singleton", "\"Id\" = 1"));
        builder.Property(p => p.Id).ValueGeneratedNever();
        builder.Property(p => p.Nom).HasMaxLength(100).IsRequired();
        builder.Property(p => p.Telephone).HasMaxLength(20).IsRequired();
        builder.Property(p => p.Email).HasMaxLength(150).IsRequired();
        builder.Property(p => p.Adresse).HasMaxLength(300).IsRequired();
        builder.Property(p => p.FraisLivraison).HasColumnType("numeric(10,2)");
        builder.Property(p => p.MontantMinimumLivraison).HasColumnType("numeric(10,2)");
    }
}
