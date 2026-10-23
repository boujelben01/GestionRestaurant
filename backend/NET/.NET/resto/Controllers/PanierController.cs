using Microsoft.AspNetCore.Mvc;
using resto.DTO;
using resto.Repositories;

namespace resto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class PanierController : ControllerBase
    {
        private readonly IPanierRepository _panierRepository;

        public PanierController(IPanierRepository panierRepository)
        {
            _panierRepository = panierRepository;
        }

        [HttpGet("me")]
        public async Task<ActionResult<PanierDTO>> GetMyPanier([FromQuery] string userId)
        {
            try
            {
                var panier = await _panierRepository.GetOrCreatePanierAsync(userId);

                var panierDto = new PanierDTO
                {
                    Id = panier.Id,
                    UserId = panier.UserId,
                    Items = panier.Items.Select(item => new PanierItemDto
                    {
                        ArticleId = item.ArticleId,
                        Quantity = item.Quantite,
                        PrixUnitaire = item.Article?.Prix ?? 0
                    }).ToList()
                };

                return Ok(panierDto);
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }

        [HttpPost("{panierId}/articles/{articleId}")]
        public async Task<IActionResult> AddArticleToPanier(int panierId, int articleId, [FromBody] int quantite)
        {
            if (quantite <= 0)
                return BadRequest("Quantity must be greater than zero.");

            try
            {
                await _panierRepository.AddArticleToPanierAsync(panierId, articleId, quantite);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }

        [HttpDelete("{panierId}/articles/{articleId}")]
        public async Task<IActionResult> RemoveArticleFromPanier(int panierId, int articleId)
        {
            try
            {
                await _panierRepository.RemoveArticleFromPanierAsync(panierId, articleId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }

        [HttpDelete("{panierId}")]
        public async Task<IActionResult> ViderPanier(int panierId)
        {
            try
            {
                await _panierRepository.ViderPanierAsync(panierId);
                return NoContent();
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Internal server error: " + ex.Message);
            }
        }
    }
}
