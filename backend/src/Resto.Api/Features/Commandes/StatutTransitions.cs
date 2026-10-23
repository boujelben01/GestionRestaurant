using Resto.Api.Common;
using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes;

public enum TransitionKind
{
    /// <summary>Le statut demandé est déjà le statut courant (idempotent, rien à écrire).</summary>
    Unchanged,
    Allowed,
    Forbidden
}

/// <summary>
/// Moteur unique des règles de cycle de vie d'une commande, partagé par l'administration et par
/// l'annulation côté client :
/// EnAttente → EnPreparation | Annulee ; EnPreparation → Prete | Annulee ; Prete → Terminee | Annulee ;
/// Terminee et Annulee sont finaux.
/// </summary>
public static class StatutTransitions
{
    private static readonly IReadOnlyDictionary<StatutCommande, StatutCommande[]> Next =
        new Dictionary<StatutCommande, StatutCommande[]>
        {
            [StatutCommande.EnAttente] = [StatutCommande.EnPreparation, StatutCommande.Annulee],
            [StatutCommande.EnPreparation] = [StatutCommande.Prete, StatutCommande.Annulee],
            [StatutCommande.Prete] = [StatutCommande.Terminee, StatutCommande.Annulee],
            [StatutCommande.Terminee] = [],
            [StatutCommande.Annulee] = []
        };

    /// <summary>Statuts atteignables depuis <paramref name="from"/> (vide pour un statut final).</summary>
    public static IReadOnlyList<StatutCommande> NextOf(StatutCommande from) => Next[from];

    public static bool IsFinal(StatutCommande statut) => Next[statut].Length == 0;

    public static TransitionKind Evaluate(StatutCommande from, StatutCommande to)
    {
        if (from == to)
        {
            return TransitionKind.Unchanged;
        }

        return Next[from].Contains(to) ? TransitionKind.Allowed : TransitionKind.Forbidden;
    }

    public static bool CanTransition(StatutCommande from, StatutCommande to) =>
        Evaluate(from, to) == TransitionKind.Allowed;

    /// <summary>Lève un 409 si la transition est interdite ; ne fait rien pour un statut inchangé.</summary>
    public static void EnsureAllowed(StatutCommande from, StatutCommande to)
    {
        if (Evaluate(from, to) == TransitionKind.Forbidden)
        {
            throw AppException.Conflict($"{from} -> {to} n'est pas autorisé.");
        }
    }

    /// <summary>Le client ne peut annuler qu'une commande encore en attente (jamais une commande déjà prise en charge).</summary>
    public static bool CanClientCancel(StatutCommande from) =>
        from == StatutCommande.EnAttente && CanTransition(from, StatutCommande.Annulee);
}
