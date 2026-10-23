using resto.Models;

namespace resto.Repositories
{
    public interface IArticleRepository
    {
        Task<IEnumerable<Article>> GetAllArticlesAsync();
        Task<Article?> GetArticleByIdAsync(int id);
        Task<Article> AddArticleAsync(Article article);
        Task<Article> UpdateArticleAsync(Article article);
        Task<bool> DeleteArticleAsync(int id);
    }
}
