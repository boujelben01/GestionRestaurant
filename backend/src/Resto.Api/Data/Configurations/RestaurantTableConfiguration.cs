using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class RestaurantTableConfiguration : IEntityTypeConfiguration<RestaurantTable>
{
    public void Configure(EntityTypeBuilder<RestaurantTable> builder)
    {
        builder.ToTable("Tables", t => t.HasCheckConstraint("CK_Tables_Capacite", "\"Capacite\" > 0"));
        builder.HasIndex(t => t.Numero).IsUnique();
        builder.HasIndex(t => t.Code).IsUnique();
    }
}
