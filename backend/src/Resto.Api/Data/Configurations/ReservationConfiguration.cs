using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Resto.Api.Domain;

namespace Resto.Api.Data.Configurations;

public class ReservationConfiguration : IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Reservation> builder)
    {
        builder.ToTable("Reservations", t =>
        {
            t.HasCheckConstraint("CK_Reservations_NombrePersonnes", "\"NombrePersonnes\" BETWEEN 1 AND 20");
            t.HasCheckConstraint("CK_Reservations_Statut", EnumSql.InList<StatutReservation>("Statut"));
        });
        builder.Property(r => r.NomClient).HasMaxLength(100).IsRequired();
        builder.Property(r => r.Telephone).HasMaxLength(20).IsRequired();
        builder.Property(r => r.DateHeure).HasColumnType("timestamp with time zone");
        builder.Property(r => r.Statut).HasConversion<string>().HasMaxLength(20);
        builder.Property(r => r.Note).HasMaxLength(500);
        builder.Property(r => r.DateCreation).HasColumnType("timestamp with time zone").HasDefaultValueSql("now()");
        builder.HasIndex(r => r.DateHeure);
        builder.HasIndex(r => r.UserId);
        builder.HasOne(r => r.User).WithMany().HasForeignKey(r => r.UserId).OnDelete(DeleteBehavior.SetNull);
        builder.HasOne(r => r.Table).WithMany().HasForeignKey(r => r.TableId).OnDelete(DeleteBehavior.SetNull);
    }
}
