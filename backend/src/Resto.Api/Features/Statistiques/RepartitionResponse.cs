namespace Resto.Api.Features.Statistiques;

public record RepartitionResponse(
    IReadOnlyList<RepartitionTypeResponse> ParType,
    IReadOnlyList<RepartitionStatutResponse> ParStatut,
    IReadOnlyList<RepartitionCategorieResponse> ParCategorie);
