namespace Resto.Api.Features.Menu.Admin;

public record CategorieAdminResponse(int Id, string NomFr, int Ordre, bool EstActive, int NombreArticlesActifs);
