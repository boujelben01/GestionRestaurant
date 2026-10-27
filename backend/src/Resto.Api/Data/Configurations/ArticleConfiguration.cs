using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class ArticleConfiguration : IEntityTypeConfiguration<Article>
{
    public void Configure(EntityTypeBuilder<Article> builder)
    {
        builder.ToTable("Articles", t => t.HasCheckConstraint("CK_Articles_Prix", "\"Prix\" >= 0"));
        builder.Property(a => a.NomFr).HasMaxLength(150).IsRequired();
        builder.Property(a => a.DescriptionFr).HasMaxLength(1000);
        builder.Property(a => a.Prix).HasColumnType("numeric(10,2)");
        builder.Property(a => a.ImageUrl).HasMaxLength(500);
        builder.Property(a => a.DateCreation).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.Property(a => a.DateMiseAJour).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.HasIndex(a => new { a.CategorieId, a.Ordre });
        builder.HasOne(a => a.Categorie).WithMany(c => c.Articles)
            .HasForeignKey(a => a.CategorieId).OnDelete(DeleteBehavior.Restrict);
    }
}
