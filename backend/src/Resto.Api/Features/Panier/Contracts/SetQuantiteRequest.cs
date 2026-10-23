using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Panier.Contracts;

public record SetQuantiteRequest([Range(1, PanierRules.MaxQuantite)] int Quantite);
