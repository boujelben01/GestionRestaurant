namespace Resto.Api.Features.Menu.Contracts;

public record MenuCategorieResponse(int Id, string Nom, int Ordre, IReadOnlyList<MenuArticleResponse> Articles);
