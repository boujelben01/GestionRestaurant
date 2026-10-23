using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class HoraireConfiguration : IEntityTypeConfiguration<Horaire>
{
    public void Configure(EntityTypeBuilder<Horaire> builder)
    {
        builder.ToTable("Horaires", t => t.HasCheckConstraint("CK_Horaires_JourSemaine", "\"JourSemaine\" BETWEEN 0 AND 6"));
        builder.HasIndex(h => h.JourSemaine).IsUnique();
    }
}
