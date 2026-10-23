using System.ComponentModel.DataAnnotations;
using Resto.Api.Domain;

namespace Resto.Api.Features.Commandes.Admin;

/// <param name="Statut">Statut cible (chaîne : EnAttente, EnPreparation, Prete, Terminee, Annulee).</param>
/// <param name="Version">Facultatif : `version` lue dans le détail ; si elle ne correspond plus, 409.</param>
public record ChangerStatutRequest([Required] StatutCommande? Statut, uint? Version = null);
