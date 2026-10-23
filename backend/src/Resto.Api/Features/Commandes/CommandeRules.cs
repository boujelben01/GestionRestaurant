using System.Globalization;
using Resto.Api.Common;
using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes;

public readonly record struct CommandeTotals(decimal SousTotal, decimal FraisLivraison, decimal Total);

public static class CommandeRules
{
    public const int AdresseMin = 10;
    public const int AdresseMax = 500;

    public static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);

    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    public static void ValidateShape(TypeCommande type, string? adresse, Guid? tableCode)
    {
        switch (type)
        {
            case TypeCommande.Livraison:
                if (adresse is null || adresse.Length is < AdresseMin or > AdresseMax)
                {
                    throw AppException.Invalid("AdresseLivraison",
                        $"L'adresse de livraison est obligatoire ({AdresseMin} à {AdresseMax} caractères).");
                }
                RejectTable(tableCode);
                break;

            case TypeCommande.SurPlace:
                if (tableCode is null || tableCode == Guid.Empty)
                {
                    throw AppException.Invalid("TableCode", "Le code de la table est obligatoire pour une commande sur place.");
                }
                RejectAddress(adresse);
                break;

            case TypeCommande.ARemporter:
                RejectAddress(adresse);
                RejectTable(tableCode);
                break;
        }
    }

    public static CommandeTotals ComputeTotals(
        IEnumerable<(decimal Prix, int Quantite)> lignes, TypeCommande type, decimal fraisLivraison, decimal minimumLivraison)
    {
        var sousTotal = lignes.Sum(l => Round(l.Prix * l.Quantite));
        var frais = type == TypeCommande.Livraison ? Round(fraisLivraison) : 0m;

        if (type == TypeCommande.Livraison && sousTotal < minimumLivraison)
        {
            throw AppException.Invalid("Panier",
                $"Le montant minimum pour une livraison est de {Format(minimumLivraison)} DT (sous-total actuel : {Format(sousTotal)} DT).");
        }

        return new CommandeTotals(sousTotal, frais, sousTotal + frais);
    }

    private static string Format(decimal value) => value.ToString("0.00", CultureInfo.InvariantCulture);

    private static void RejectAddress(string? adresse)
    {
        if (adresse is not null)
        {
            throw AppException.Invalid("AdresseLivraison", "L'adresse de livraison n'est acceptée que pour une livraison.");
        }
    }

    private static void RejectTable(Guid? tableCode)
    {
        if (tableCode is not null)
        {
            throw AppException.Invalid("TableCode", "Le code de table n'est accepté que pour une commande sur place.");
        }
    }
}
