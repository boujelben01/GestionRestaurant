using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class CategorieConfiguration : IEntityTypeConfiguration<Categorie>
{
    public void Configure(EntityTypeBuilder<Categorie> builder)
    {
        builder.ToTable("Categories");
        builder.Property(c => c.NomFr).HasMaxLength(100).IsRequired();
        builder.Property(c => c.NomAr).HasMaxLength(100).IsRequired();
        builder.HasIndex(c => c.NomFr).IsUnique();
    }
}
