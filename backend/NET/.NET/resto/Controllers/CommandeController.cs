using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using resto.DTO;
using resto.Models;
using resto.Repositories;
using resto.Data;

namespace resto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CommandeController : ControllerBase
    {
        private readonly ICommandeRepository _commandeRepository;
        private readonly ApplicationDbContext _context;

        public CommandeController(ICommandeRepository commandeRepository, ApplicationDbContext context)
        {
            _commandeRepository = commandeRepository;
            _context = context;
        }

        private static CommandeDto ToDto(Commande c) => new()
        {
            Id = c.Id,
            ClientId = c.UserId,
            Username = c.NomClient,
            Total = c.Total,
            OrderDate = c.DateCommande,
            Items = c.Items.Select(item => new CommandeItemDto
            {
                ArticleId = item.ArticleId,
                ArticleName = item.NomArticle,
                Quantity = item.Quantite,
                PrixUnitaire = item.PrixUnitaire
            }).ToList()
        };

        [HttpPost("validerCommandeParUser")]
        public async Task<IActionResult> ValiderCommandeParUser([FromBody] string userId)
        {
            if (string.IsNullOrEmpty(userId))
            {
                return BadRequest("Identifiant utilisateur invalide.");
            }

            try
            {
                var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId);
                if (user == null)
                {
                    return NotFound("Utilisateur introuvable.");
                }

                var panier = await _context.Paniers
                    .Include(p => p.Items)
                    .ThenInclude(i => i.Article)
                    .FirstOrDefaultAsync(p => p.UserId == userId);
                if (panier == null || !panier.Items.Any())
                {
                    return BadRequest("Aucun panier actif trouvé ou le panier est vide.");
                }

                var items = panier.Items.Select(item => new CommandeItem
                {
                    ArticleId = item.ArticleId,
                    NomArticle = item.Article?.Nom ?? "Nom d'article inconnu",
                    Quantite = item.Quantite,
                    PrixUnitaire = item.Article?.Prix ?? 0
                }).ToList();

                var commande = new Commande
                {
                    UserId = user.Id,
                    NomClient = user.UserName ?? "Nom d'utilisateur inconnu",
                    Total = items.Sum(i => i.PrixUnitaire * i.Quantite),
                    DateCommande = DateTime.UtcNow,
                    Items = items
                };

                await _commandeRepository.CreateCommandeAsync(commande);

                return Ok(new { Message = "Commande validée avec succès.", CommandeId = commande.Id });
            }
            catch (DbUpdateException dbEx)
            {
                return StatusCode(500, "Erreur interne du serveur : " + (dbEx.InnerException?.Message ?? dbEx.Message));
            }
            catch (Exception ex)
            {
                return StatusCode(500, "Erreur interne du serveur : " + ex.Message);
            }
        }

        [HttpGet("userCommandes")]
        public async Task<IActionResult> GetUserCommandes([FromQuery] string userId)
        {
            if (string.IsNullOrEmpty(userId))
            {
                return BadRequest("L'identifiant de l'utilisateur est requis.");
            }

            try
            {
                var commandes = await _commandeRepository.GetCommandesByClientIdAsync(userId);

                if (!commandes.Any())
                {
                    return NotFound("Aucune commande trouvée pour cet utilisateur.");
                }

                return Ok(commandes.Select(ToDto).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur interne du serveur : {ex.Message}");
            }
        }

        [HttpGet("allCommandes")]
        public async Task<IActionResult> GetAllCommandes()
        {
            try
            {
                var commandes = await _context.Commandes
                    .Include(c => c.Items)
                    .ToListAsync();

                if (!commandes.Any())
                {
                    return NotFound("Aucune commande trouvée.");
                }

                return Ok(commandes.Select(ToDto).ToList());
            }
            catch (Exception ex)
            {
                return StatusCode(500, $"Erreur interne du serveur : {ex.Message}");
            }
        }
    }
}
