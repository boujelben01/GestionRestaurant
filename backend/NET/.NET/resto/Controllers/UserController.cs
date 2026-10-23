
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using resto.DTOs;
using resto.Models;

namespace resto.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UserController : ControllerBase
    {

        private readonly UserManager<ApplicationUser> _userManager;

        public UserController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, IConfiguration configuration)
        {
            _userManager = userManager;
        }

        // GET: api/Account/GetUser
        [HttpGet("getUserInfoByName")]
        public async Task<IActionResult> GetUserInfoByName(string username)
        {
           

            // Récupérez l'utilisateur par nom d'utilisateur
            var user = await _userManager.FindByNameAsync(username);
            if (user == null)
            {
                return NotFound("Utilisateur non trouvé");
            }

            var userInfo = new
            {
                Username = user.UserName,
                Email = user.Email
            };

            return Ok(userInfo);
        }

        // GET: api/Account/GetUsers
        [HttpGet("getUsers")]
        public async Task<IActionResult> GetUsers()
        {
            List<ApplicationUser> users = await _userManager.Users.ToListAsync();
            return Ok(users);
        }

        [HttpPut("updateUserInfoByName")]
        public async Task<IActionResult> UpdateUserInfoByName(string username, UserUpdateDTO model)
        {
            // Récupérez l'utilisateur par nom d'utilisateur
            var user = await _userManager.FindByNameAsync(username);
            if (user == null)
            {
                return NotFound("Utilisateur non trouvé");
            }

            // Mettez à jour les informations de l'utilisateur
            user.UserName = model.Nom;
            user.Email = model.Email;

            var updateResult = await _userManager.UpdateAsync(user);
            if (!updateResult.Succeeded)
            {
                return BadRequest("Erreur lors de la mise à jour des informations de l'utilisateur");
            }

            return Ok("Informations de l'utilisateur mises à jour avec succès");
        }

        //supprimer un utilisateur 
        [HttpDelete("deleteUserByUserName")]
        public async Task<IActionResult> DeleteUser(string username)
        {
            // Récupérez l'utilisateur par nom d'utilisateur
            var user = await _userManager.FindByNameAsync(username);
            if (user == null)
            {
                return NotFound("Utilisateur non trouvé");
            }
            // Supprimer l'utilisateur
            var deleteResult = await _userManager.DeleteAsync(user);
            if (!deleteResult.Succeeded)
            {
                return BadRequest("Erreur lors de la suppression de l'utilisateur");
            }
            return Ok("Utilisateur supprimé avec succès");
        }


    }

}