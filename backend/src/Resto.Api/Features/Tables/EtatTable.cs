namespace Resto.Api.Features.Tables;

/// <summary>État calculé d'une table (jamais stocké) d'après ses commandes sur place.</summary>
public enum EtatTable
{
    /// <summary>Aucune commande à suivre.</summary>
    Libre,

    /// <summary>Au moins une commande EnAttente, EnPreparation ou Prete.</summary>
    Occupee,

    /// <summary>Plus rien en cours, mais au moins une commande non annulée et non payée.</summary>
    AEncaisser,

    /// <summary>Table désactivée (prioritaire sur les autres états).</summary>
    Inactive
}
