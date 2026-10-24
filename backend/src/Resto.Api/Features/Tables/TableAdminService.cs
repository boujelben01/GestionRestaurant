using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Api.Features.Tables;

public class TableAdminService(AppDbContext db)
{
    public async Task<IReadOnlyList<TableAdminResponse>> ListAsync(CancellationToken ct) =>
        (await ListQuery(db).ToListAsync(ct)).Select(ToResponse).ToList();

    public async Task<TableAdminResponse> GetAsync(int id, CancellationToken ct) =>
        ToResponse(await db.Tables.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("Table introuvable."));

    public async Task<TableAdminResponse> CreateAsync(CreateTableRequest request, CancellationToken ct)
    {
        var numero = request.Numero
            ?? (await db.Tables.MaxAsync(t => (int?)t.Numero, ct) ?? 0) + 1;
        if (numero > TableRules.NumeroMax)
        {
            throw AppException.Invalid(nameof(CreateTableRequest.Numero),
                $"Le numéro de table ne peut pas dépasser {TableRules.NumeroMax}.");
        }

        await EnsureNumeroAvailableAsync(numero, null, ct);

        var table = new RestaurantTable
        {
            Numero = numero,
            Capacite = request.Capacite,
            Code = Guid.NewGuid(),
            EstActive = true
        };
        db.Tables.Add(table);
        // Deux créations simultanées avec le même numéro : l'index unique PostgreSQL lève une violation, que
        // GlobalExceptionHandler traduit en 409.
        await db.SaveChangesAsync(ct);
        return ToResponse(table);
    }

    public async Task<TableAdminResponse> UpdateAsync(int id, UpdateTableRequest request, CancellationToken ct)
    {
        var table = await FindAsync(id, ct);
        await EnsureNumeroAvailableAsync(request.Numero, id, ct);

        // Attention : le numéro affiché sur une commande est lu sur la table (jointure), pas copié. Changer le
        // numéro d'une table modifie donc aussi le numéro montré sur ses commandes passées.
        table.Numero = request.Numero;
        table.Capacite = request.Capacite;
        await db.SaveChangesAsync(ct);
        return ToResponse(table);
    }

    /// <summary>Activer / désactiver. Une table inactive refuse les nouvelles commandes sur place et son QR cesse de répondre ; les commandes passées ne changent pas.</summary>
    public async Task<TableAdminResponse> SetActiveAsync(int id, bool estActive, CancellationToken ct)
    {
        var table = await FindAsync(id, ct);
        if (table.EstActive != estActive)
        {
            table.EstActive = estActive;
            await db.SaveChangesAsync(ct);
        }

        return ToResponse(table);
    }

    /// <summary>Nouveau GUID : les QR déjà imprimés avec l'ancien code cessent de fonctionner (404).</summary>
    public async Task<TableAdminResponse> RegenerateCodeAsync(int id, CancellationToken ct)
    {
        var table = await FindAsync(id, ct);
        table.Code = Guid.NewGuid();
        await db.SaveChangesAsync(ct);
        return ToResponse(table);
    }

    // Requête isolée pour que SqlTranslationTests vérifie sa traduction avec le fournisseur Npgsql.
    internal static IQueryable<RestaurantTable> ListQuery(AppDbContext db) =>
        db.Tables.AsNoTracking().OrderBy(t => t.Numero).ThenBy(t => t.Id);

    private async Task<RestaurantTable> FindAsync(int id, CancellationToken ct) =>
        await db.Tables.FirstOrDefaultAsync(t => t.Id == id, ct)
            ?? throw AppException.NotFound("Table introuvable.");

    private async Task EnsureNumeroAvailableAsync(int numero, int? exceptId, CancellationToken ct)
    {
        if (await db.Tables.AnyAsync(t => t.Numero == numero && t.Id != exceptId, ct))
        {
            throw AppException.Conflict($"La table n° {numero} existe déjà.");
        }
    }

    private static TableAdminResponse ToResponse(RestaurantTable t) => new(t.Id, t.Numero, t.Code, t.Capacite, t.EstActive);
}
