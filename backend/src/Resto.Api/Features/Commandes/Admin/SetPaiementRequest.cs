using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Commandes.Admin;

public record SetPaiementRequest([Required] bool? EstPayee);
