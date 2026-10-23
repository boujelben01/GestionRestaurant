using resto.Models;

namespace resto.Repositories
{
    public interface ICategorieRepository
    {
        Task<List<Categorie>> GetAll();
        Task<Categorie?> GetById(int id);
        Task<Categorie?> GetByName(string name);
        Task<Categorie> Add(Categorie categorie);
        Task Update(Categorie categorie);
        Task Delete(int id);
        Task<Categorie?> GetByIdWithFoods(int id);
    }
}
