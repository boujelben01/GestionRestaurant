using Microsoft.EntityFrameworkCore;
using resto.Data;
using resto.Models;

namespace resto.Repositories
{
    public class CommandeRepository : ICommandeRepository
    {
        private readonly ApplicationDbContext _context;

        public CommandeRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task CreateCommandeAsync(Commande commande)
        {
            if (commande == null)
            {
                throw new ArgumentNullException(nameof(commande), "La commande ne peut pas être null.");
            }

            _context.Commandes.Add(commande);
            await _context.SaveChangesAsync();
        }

        public async Task<List<Commande>> GetCommandesByClientIdAsync(string clientId)
        {
            if (string.IsNullOrWhiteSpace(clientId))
            {
                throw new ArgumentException("L'identifiant du client est requis.", nameof(clientId));
            }

            return await _context.Commandes
                .Where(c => c.UserId == clientId)
                .Include(c => c.Items)
                .ToListAsync();
        }
    }
}
