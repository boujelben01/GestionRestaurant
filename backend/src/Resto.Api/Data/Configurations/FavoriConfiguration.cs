using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class FavoriConfiguration : IEntityTypeConfiguration<Favori>
{
    public void Configure(EntityTypeBuilder<Favori> builder)
    {
        builder.ToTable("Favoris");
        builder.HasKey(f => new { f.UserId, f.ArticleId });
        builder.HasOne(f => f.User).WithMany().HasForeignKey(f => f.UserId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(f => f.Article).WithMany().HasForeignKey(f => f.ArticleId).OnDelete(DeleteBehavior.Cascade);
    }
}
