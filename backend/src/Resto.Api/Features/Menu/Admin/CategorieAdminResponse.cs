namespace Resto.Api.Features.Menu.Admin;

public record CategorieAdminResponse(int Id, string NomFr, string NomAr, int Ordre, bool EstActive, int NombreArticlesActifs);
