using Microsoft.AspNetCore.Mvc;
using resto.DTOs;
using resto.Models;
using resto.Repositories;

[ApiController]
[Route("api/[controller]")]
public class ArticlesController : ControllerBase
{
    private readonly IArticleRepository _articleRepository;

    public ArticlesController(IArticleRepository articleRepository)
    {
        _articleRepository = articleRepository;
    }

    private static ArticleDTO ToDto(Article a) => new()
    {
        Id = a.Id,
        Nom = a.Nom,
        Prix = a.Prix,
        Description = a.Description,
        CategorieId = a.CategorieId
    };

    [HttpGet]
    public async Task<ActionResult<IEnumerable<ArticleDTO>>> GetArticles()
    {
        var articles = await _articleRepository.GetAllArticlesAsync();
        return Ok(articles.Select(ToDto).ToList());
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ArticleDTO>> GetArticle(int id)
    {
        var article = await _articleRepository.GetArticleByIdAsync(id);
        if (article == null)
        {
            return NotFound();
        }

        return Ok(ToDto(article));
    }

    [HttpPost]
    public async Task<ActionResult<ArticleDTO>> CreateArticle(ArticleDTO articleDTO)
    {
        var article = new Article
        {
            Nom = articleDTO.Nom,
            Prix = articleDTO.Prix,
            Description = articleDTO.Description,
            CategorieId = articleDTO.CategorieId
        };

        await _articleRepository.AddArticleAsync(article);

        var articleDto = ToDto(article);
        return CreatedAtAction(nameof(GetArticle), new { id = articleDto.Id }, articleDto);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateArticle(int id, ArticleDTO articleDTO)
    {
        var article = await _articleRepository.GetArticleByIdAsync(id);
        if (article == null)
        {
            return NotFound();
        }

        article.Nom = articleDTO.Nom;
        article.Prix = articleDTO.Prix;
        article.Description = articleDTO.Description;
        article.CategorieId = articleDTO.CategorieId;

        await _articleRepository.UpdateArticleAsync(article);

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeleteArticle(int id)
    {
        var success = await _articleRepository.DeleteArticleAsync(id);
        if (!success)
        {
            return NotFound();
        }

        return NoContent();
    }
}
