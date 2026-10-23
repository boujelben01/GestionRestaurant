using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class ApplicationUserConfiguration : IEntityTypeConfiguration<ApplicationUser>
{
    public void Configure(EntityTypeBuilder<ApplicationUser> builder)
    {
        builder.Property(u => u.Nom).HasMaxLength(100);
        builder.Property(u => u.DateCreation).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.Property(u => u.LangueFavorite).HasMaxLength(2).HasDefaultValue("fr");
        builder.Property(u => u.EstActif).HasDefaultValueSql("true").ValueGeneratedNever();
    }
}
