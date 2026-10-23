using resto.Models;

namespace resto.Repositories
{
    public interface ICommandeRepository
    {
        Task CreateCommandeAsync(Commande commande);
        Task<List<Commande>> GetCommandesByClientIdAsync(string clientId);
    }
}
