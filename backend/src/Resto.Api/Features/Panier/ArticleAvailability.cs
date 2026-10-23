using Resto.Api.Domain;

namespace Resto.Api.Features.Panier;

public enum ArticleStatus
{
    Ok,
    Inactif,
    Indisponible
}

public static class ArticleAvailability
{
    public static ArticleStatus Of(Article article)
    {
        if (!article.EstActif || !article.Categorie.EstActive)
        {
            return ArticleStatus.Inactif;
        }

        return article.EstDisponible ? ArticleStatus.Ok : ArticleStatus.Indisponible;
    }
}
