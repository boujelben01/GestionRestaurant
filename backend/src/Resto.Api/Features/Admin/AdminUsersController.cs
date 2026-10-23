using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Domain;

namespace Resto.Api.Features.Admin;

[ApiController]
[Route("api/admin/users")]
[Authorize(Policy = Policies.AdminOnly)]
public class AdminUsersController(AppDbContext db, UserManager<ApplicationUser> userManager) : ControllerBase
{
    private const int MaxPageSize = 50;

    [HttpGet]
    public async Task<ActionResult<PagedResult<AdminUserResponse>>> List(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(page, 1);
        pageSize = Math.Clamp(pageSize, 1, MaxPageSize);

        var query = db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(u =>
                (u.UserName != null && u.UserName.ToLower().Contains(term)) ||
                (u.Email != null && u.Email.ToLower().Contains(term)) ||
                (u.Nom != null && u.Nom.ToLower().Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(u => u.UserName)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(u => new AdminUserResponse(u.Id, u.UserName ?? string.Empty, u.Email ?? string.Empty, u.Nom, u.EstActif, u.DateCreation))
            .ToListAsync(cancellationToken);

        return new PagedResult<AdminUserResponse>(items, page, pageSize, total);
    }

    [HttpPatch("{id}/actif")]
    public async Task<ActionResult<AdminUserResponse>> SetActif(string id, SetActifRequest request)
    {
        if (!request.EstActif && id == User.FindFirstValue(ClaimTypes.NameIdentifier))
        {
            return Problem(statusCode: StatusCodes.Status400BadRequest, title: "Un administrateur ne peut pas se désactiver lui-même.");
        }

        var user = await userManager.FindByIdAsync(id);
        if (user is null)
        {
            return NotFound();
        }

        user.EstActif = request.EstActif;
        var result = await userManager.UpdateAsync(user);
        if (!result.Succeeded)
        {
            throw new InvalidOperationException("Mise à jour de l'utilisateur impossible.");
        }

        return new AdminUserResponse(user.Id, user.UserName ?? string.Empty, user.Email ?? string.Empty, user.Nom, user.EstActif, user.DateCreation);
    }
}
