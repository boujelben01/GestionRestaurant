using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Resto.Api.Common;
using Resto.Api.Domain;
using Resto.Api.Features.Auth.Contracts;

namespace Resto.Api.Features.Auth;

[ApiController]
[Route("api/auth")]
public class AuthController(
    UserManager<ApplicationUser> userManager,
    SignInManager<ApplicationUser> signInManager,
    IPasswordHasher<ApplicationUser> passwordHasher,
    ITokenService tokenService,
    ILogger<AuthController> logger) : ControllerBase
{
    private const string InvalidCredentials = "Identifiant ou mot de passe incorrect.";

    [HttpPost("register")]
    [AllowAnonymous]
    [EnableRateLimiting(Policies.AuthRateLimit)]
    public async Task<ActionResult<UserResponse>> Register(RegisterRequest request)
    {
        var user = new ApplicationUser
        {
            UserName = string.IsNullOrWhiteSpace(request.UserName) ? request.Email : request.UserName.Trim(),
            Email = request.Email.Trim(),
            Nom = request.Nom.Trim(),
            PhoneNumber = string.IsNullOrWhiteSpace(request.Telephone) ? null : request.Telephone.Trim(),
            LangueFavorite = request.LangueFavorite ?? "fr",
            DateCreation = DateTime.UtcNow
        };

        var created = await userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
        {
            return created.IsDuplicate()
                ? Problem(statusCode: StatusCodes.Status409Conflict, title: "Un compte existe déjà avec cet identifiant ou cet e-mail.")
                : ValidationProblem(created.ToModelState("Password"));
        }

        var roleResult = await userManager.AddToRoleAsync(user, Roles.Client);
        if (!roleResult.Succeeded)
        {
            await userManager.DeleteAsync(user);
            throw new InvalidOperationException("Impossible d'attribuer le rôle Client au nouvel utilisateur.");
        }

        return CreatedAtAction(nameof(Me), UserResponse.From(user, [Roles.Client]));
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(Policies.AuthRateLimit)]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var identifiant = request.Identifiant.Trim();
        var user = await userManager.FindByNameAsync(identifiant) ?? await userManager.FindByEmailAsync(identifiant);

        if (user is null)
        {
            // Même coût de calcul que pour un mot de passe vérifié, pour ne pas révéler l'existence du compte.
            passwordHasher.HashPassword(new ApplicationUser(), request.Password);
            return InvalidCredentialsResponse();
        }

        var result = await signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (result.IsLockedOut)
        {
            logger.LogWarning("Connexion refusée : compte {UserId} verrouillé.", user.Id);
            return InvalidCredentialsResponse();
        }
        if (!result.Succeeded)
        {
            return InvalidCredentialsResponse();
        }

        if (!user.EstActif)
        {
            return Problem(statusCode: StatusCodes.Status403Forbidden, title: "Ce compte est désactivé.");
        }

        var roles = await userManager.GetRolesAsync(user);
        var token = tokenService.CreateAccessToken(user, roles);
        return new LoginResponse(token.Token, token.ExpiresAtUtc, UserResponse.From(user, roles));
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserResponse>> Me()
    {
        var user = await GetCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized();
        }

        return UserResponse.From(user, await userManager.GetRolesAsync(user));
    }

    [HttpPut("me")]
    public async Task<ActionResult<UserResponse>> UpdateMe(UpdateProfileRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized();
        }

        user.Nom = string.IsNullOrWhiteSpace(request.Nom) ? null : request.Nom.Trim();
        user.PhoneNumber = string.IsNullOrWhiteSpace(request.Telephone) ? null : request.Telephone.Trim();
        user.LangueFavorite = request.LangueFavorite;

        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            return ValidationProblem(result.ToModelState("Password"));
        }

        return UserResponse.From(user, await userManager.GetRolesAsync(user));
    }

    [HttpPost("me/password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
    {
        var user = await GetCurrentUserAsync();
        if (user is null)
        {
            return Unauthorized();
        }

        var result = await userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            return ValidationProblem(result.ToModelState("NewPassword"));
        }

        return NoContent();
    }

    private ObjectResult InvalidCredentialsResponse() =>
        Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Authentification échouée.", detail: InvalidCredentials);

    private async Task<ApplicationUser?> GetCurrentUserAsync()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return id is null ? null : await userManager.FindByIdAsync(id);
    }
}
