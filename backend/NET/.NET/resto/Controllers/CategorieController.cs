using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using resto.DTOs;
using resto.Models;
using resto.Repositories;

namespace resto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategorieController : ControllerBase
    {
        private readonly ICategorieRepository repository;

        public CategorieController(ICategorieRepository repository)
        {
            this.repository = repository;
        }

        [HttpGet]
        public async Task<IActionResult> GetAll()
        {
            var categories = await repository.GetAll();
            var categoriesDto = categories.Select(c => new CategorieDto { Id = c.Id, Nom = c.Nom }).ToList();
            return Ok(categoriesDto);
        }

        [HttpPost]
        public async Task<IActionResult> Ajouter(CategorieDto categorieDto)
        {
            if (!ModelState.IsValid)
            {
                return BadRequest(ModelState);
            }
            var existingCategorie = await repository.GetByName(categorieDto.Nom);
            if (existingCategorie != null)
            {
                ModelState.AddModelError("", "Categorie existante");
                return BadRequest(ModelState);
            }

            var categorie = new Categorie { Nom = categorieDto.Nom };
            var newCategorie = await repository.Add(categorie);

            return CreatedAtAction(nameof(GetByID), new { id = newCategorie.Id }, new CategorieDto { Id = newCategorie.Id, Nom = newCategorie.Nom });
        }

        [HttpGet("{id}")]
        public async Task<IActionResult> GetByID(int id)
        {
            var categorie = await repository.GetById(id);
            if (categorie == null)
            {
                return BadRequest("Categorie inexistante");
            }
            var categorieDto = new CategorieDto { Id = categorie.Id, Nom = categorie.Nom };
            return Ok(categorieDto);
        }

        [HttpGet("{id}/with-foods")]
        public async Task<IActionResult> GetByIdWithFoods(int id)
        {
            var categorie = await repository.GetByIdWithFoods(id);
            if (categorie == null)
            {
                return NotFound($"Categorie avec l'ID {id} introuvable.");
            }

            var categorieDto = new CategorieDto
            {
                Id = categorie.Id,
                Nom = categorie.Nom
            };

            var ArticleDto = categorie.Articles.Select(f => new ArticleDTO
            {
                Id = f.Id,
                Nom = f.Nom,
                Prix = f.Prix,
                CategorieId = f.CategorieId,
                Description = f.Description
            }).ToList();

            return Ok(new { Categorie = categorieDto, Foods = ArticleDto });
        }

        [HttpPut]
        public async Task<IActionResult> Edit(CategorieDto categorieDto)
        {
            if (categorieDto == null)
            {
                return BadRequest("Objet non valide");
            }
            var categorie = new Categorie { Id = categorieDto.Id, Nom = categorieDto.Nom };
            await repository.Update(categorie);
            return Ok(categorieDto);
        }

        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            try
            {
                await repository.Delete(id);
            }
            catch (DbUpdateException)
            {
                return Conflict("Impossible de supprimer une catégorie qui contient des articles.");
            }
            return NoContent();
        }
    }
}
