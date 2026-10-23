using Microsoft.EntityFrameworkCore;
using resto.Data;
using resto.Models;

namespace resto.Repositories
{
    public class PanierRepository : IPanierRepository
    {
        private readonly ApplicationDbContext _context;

        public PanierRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<Panier> GetOrCreatePanierAsync(string userId)
        {
            var panier = await FindByUserIdAsync(userId);
            if (panier != null) return panier;

            _context.Paniers.Add(new Panier { UserId = userId });
            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateException)
            {
                // Un appel concurrent a créé le panier entre-temps (index unique sur UserId).
                _context.ChangeTracker.Clear();
                var existant = await FindByUserIdAsync(userId);
                if (existant == null) throw;
                return existant;
            }

            return (await FindByUserIdAsync(userId))!;
        }

        private Task<Panier?> FindByUserIdAsync(string userId)
        {
            return _context.Paniers
                .Include(p => p.Items)
                .ThenInclude(i => i.Article)
                .FirstOrDefaultAsync(p => p.UserId == userId);
        }

        public async Task<Panier?> GetPanierByIdAsync(int idPanier)
        {
            return await _context.Paniers
                .Include(p => p.Items)
                .ThenInclude(i => i.Article)
                .FirstOrDefaultAsync(p => p.Id == idPanier);
        }

        public async Task AddArticleToPanierAsync(int panierId, int articleId, int quantite)
        {
            var panier = await GetPanierByIdAsync(panierId) ?? throw new Exception("Panier introuvable.");

            var articleExiste = await _context.Articles.AnyAsync(a => a.Id == articleId);
            if (!articleExiste)
            {
                throw new Exception("Article introuvable.");
            }

            var panierItem = panier.Items.FirstOrDefault(i => i.ArticleId == articleId);
            if (panierItem == null)
            {
                panier.Items.Add(new PanierItem { ArticleId = articleId, Quantite = quantite });
            }
            else
            {
                panierItem.Quantite += quantite;
            }

            panier.DateMiseAJour = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }

        public async Task RemoveArticleFromPanierAsync(int panierId, int articleId)
        {
            var panier = await GetPanierByIdAsync(panierId) ?? throw new Exception("Panier introuvable.");

            var panierItem = panier.Items.FirstOrDefault(i => i.ArticleId == articleId);
            if (panierItem != null)
            {
                panier.Items.Remove(panierItem);
                panier.DateMiseAJour = DateTime.UtcNow;
                await _context.SaveChangesAsync();
            }
        }

        public async Task ViderPanierAsync(int panierId)
        {
            var panier = await GetPanierByIdAsync(panierId) ?? throw new Exception("Panier introuvable.");

            panier.Items.Clear();
            panier.DateMiseAJour = DateTime.UtcNow;
            await _context.SaveChangesAsync();
        }
    }
}
