using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.IdentityModel.Tokens;
using resto.DTOs;
using resto.Models;
using resto.Repositories;
using resto.Data;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

[ApiController]
[Route("api/[controller]")]
public class AccountController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly IConfiguration _configuration;
    private readonly IPanierRepository _panierRepository;

    public AccountController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager, IConfiguration configuration, IPanierRepository panierRepository)
    {
        _userManager = userManager;
        _signInManager = signInManager;
        _configuration = configuration;
        _panierRepository = panierRepository;
    }

    [HttpPost("register")]
    public async Task<IActionResult> RegisterNewUser(UserRegisterDTO newUserDTO)
    {
        if (ModelState.IsValid)
        {
            ApplicationUser appUser = new()
            {
                UserName = newUserDTO.Username,
                Email = newUserDTO.Email
            };
            IdentityResult result = await _userManager.CreateAsync(appUser, newUserDTO.Password);
            if (result.Succeeded)
            {
                await _userManager.AddToRoleAsync(appUser, DbSeeder.RoleClient);
                var panier = await _panierRepository.GetOrCreatePanierAsync(appUser.Id);

                var response = new
                {
                    userId = appUser.Id,
                    username = appUser.UserName,
                    email = appUser.Email,
                    panierId = panier.Id
                };

                return Ok(response);
            }
            else
            {
                ModelState.AddModelError("Erreur", "Problème de création d'utilisateur");
                foreach (var error in result.Errors)
                {
                    ModelState.AddModelError(error.Code, error.Description);
                }
            }
        }
        return BadRequest(ModelState);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(UserLoginDTO model)
    {
        if (ModelState.IsValid)
        {
            ApplicationUser? user = await _userManager.FindByNameAsync(model.Username);
            if (user != null)
            {
                if (await _userManager.CheckPasswordAsync(user, model.Password))
                {
                    var panier = await _panierRepository.GetOrCreatePanierAsync(user.Id);

                    var claims = new List<Claim>
                    {
                        new Claim(ClaimTypes.Name, user.UserName ?? string.Empty),
                        new Claim(ClaimTypes.NameIdentifier, user.Id),
                        new Claim("PanierId", panier.Id.ToString()),
                        new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString())
                    };

                    var secretKey = _configuration["Jwt:SecretKey"];
                    if (string.IsNullOrEmpty(secretKey))
                    {
                        ModelState.AddModelError("Erreur", "Clé secrète JWT non configurée");
                        return BadRequest(ModelState);
                    }

                    var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secretKey));
                    var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

                    var token = new JwtSecurityToken(
                        issuer: _configuration["Jwt:Issuer"],
                        audience: _configuration["Jwt:Audience"],
                        claims: claims,
                        expires: DateTime.UtcNow.AddHours(1),
                        signingCredentials: creds);

                    var _token = new JwtSecurityTokenHandler().WriteToken(token);

                    var response = new
                    {
                        userId = user.Id,
                        username = user.UserName,
                        email = user.Email,
                        panierId = panier.Id,
                        token = _token
                    };

                    return Ok(response);
                }
                else
                {
                    ModelState.AddModelError("Erreur", "Utilisateur n'est pas autorisé à se connecter");
                    return Unauthorized(ModelState);
                }
            }
            return BadRequest(ModelState);
        }
        return BadRequest(ModelState);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        await _signInManager.SignOutAsync();
        return Ok("success");
    }
}
