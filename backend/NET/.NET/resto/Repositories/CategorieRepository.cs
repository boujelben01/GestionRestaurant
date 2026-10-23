using Microsoft.EntityFrameworkCore;
using resto.Data;
using resto.Models;

namespace resto.Repositories
{
    public class CategorieRepository : ICategorieRepository
    {
        private readonly ApplicationDbContext context;

        public CategorieRepository(ApplicationDbContext context)
        {
            this.context = context;
        }

        public async Task<Categorie> Add(Categorie categorie)
        {
            categorie.Id = 0;
            var result = await context.Categories.AddAsync(categorie);
            await context.SaveChangesAsync();
            return result.Entity;
        }

        public async Task Delete(int id)
        {
            var categorie = await context.Categories.FindAsync(id);
            if (categorie != null)
            {
                context.Categories.Remove(categorie);
                await context.SaveChangesAsync();
            }
        }

        public async Task<List<Categorie>> GetAll()
        {
            return await context.Categories.OrderBy(c => c.Ordre).ThenBy(c => c.Id).ToListAsync();
        }

        public async Task<Categorie?> GetById(int id)
        {
            return await context.Categories.FindAsync(id);
        }

        public async Task<Categorie?> GetByName(string name)
        {
            return await context.Categories.FirstOrDefaultAsync(c => c.Nom == name);
        }

        public async Task Update(Categorie categorie)
        {
            var existante = await context.Categories.FindAsync(categorie.Id);
            if (existante == null) return;

            existante.Nom = categorie.Nom;
            await context.SaveChangesAsync();
        }

        public async Task<Categorie?> GetByIdWithFoods(int id)
        {
            return await context.Categories.Include(c => c.Articles).FirstOrDefaultAsync(c => c.Id == id);
        }
    }
}
