using System.ComponentModel.DataAnnotations;

namespace Resto.Api.Features.Panier.Contracts;

public record AddPanierItemRequest(
    [Range(1, int.MaxValue)] int ArticleId,
    [Range(1, PanierRules.MaxQuantite)] int Quantite);
