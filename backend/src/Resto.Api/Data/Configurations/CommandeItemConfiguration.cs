using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class CommandeItemConfiguration : IEntityTypeConfiguration<CommandeItem>
{
    public void Configure(EntityTypeBuilder<CommandeItem> builder)
    {
        builder.ToTable("CommandeItems", t => t.HasCheckConstraint("CK_CommandeItems_Quantite", "\"Quantite\" > 0"));
        builder.Property(i => i.NomFr).HasMaxLength(150).IsRequired();
        builder.Property(i => i.PrixUnitaire).HasColumnType("numeric(10,2)");
        builder.HasIndex(i => i.CommandeId);
        builder.HasOne(i => i.Commande).WithMany(c => c.Items).HasForeignKey(i => i.CommandeId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne(i => i.Article).WithMany().HasForeignKey(i => i.ArticleId).OnDelete(DeleteBehavior.SetNull);
    }
}
