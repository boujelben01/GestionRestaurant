using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class PanierItemConfiguration : IEntityTypeConfiguration<PanierItem>
{
    public void Configure(EntityTypeBuilder<PanierItem> builder)
    {
        builder.ToTable("PanierItems", t => t.HasCheckConstraint("CK_PanierItems_Quantite", "\"Quantite\" BETWEEN 1 AND 20"));
        builder.HasIndex(i => new { i.PanierId, i.ArticleId }).IsUnique();
        builder.HasOne(i => i.Panier).WithMany(p => p.Items).HasForeignKey(i => i.PanierId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(i => i.Article).WithMany().HasForeignKey(i => i.ArticleId).OnDelete(DeleteBehavior.Cascade);
    }
}
