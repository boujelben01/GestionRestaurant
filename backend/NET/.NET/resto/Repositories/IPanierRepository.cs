using resto.Models;

namespace resto.Repositories
{
    public interface IPanierRepository
    {
        Task<Panier> GetOrCreatePanierAsync(string userId);
        Task<Panier?> GetPanierByIdAsync(int idPanier);
        Task AddArticleToPanierAsync(int panierId, int articleId, int quantite);
        Task RemoveArticleFromPanierAsync(int panierId, int articleId);
        Task ViderPanierAsync(int panierId);
    }
}
