using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Naologic_API.Constants;
using Naologic_API.Models.Admin;
using Naologic_API.Repositories;

namespace Naologic_API.Controllers;

[ApiController]
[Authorize(Roles = UserRoles.Admin)]
[Route("api/admin")]
public sealed class AdminController : ControllerBase
{
    private readonly UsersRepository _usersRepository;

    public AdminController(UsersRepository usersRepository)
    {
        _usersRepository = usersRepository;
    }

    [HttpGet("users")]
    public async Task<ActionResult<IReadOnlyList<AdminUserResponse>>> GetUsers(CancellationToken cancellationToken)
    {
        var users = await _usersRepository.GetAllUsersAsync(cancellationToken);
        return Ok(users);
    }

    [HttpPut("users/update-roles")]
    public async Task<IResult> UpdateUserRoles([FromBody] UpdateUserRolesRequest request, CancellationToken cancellationToken)
    {
        if (request.Updates.Count == 0)
        {
            return Results.NoContent();
        }

        var invalidRoles = request.Updates
            .Where(update => update.Role is not (UserRoles.Admin or UserRoles.Planner or UserRoles.Viewer))
            .Select(update => update.Role)
            .Distinct()
            .ToArray();

        if (invalidRoles.Length > 0)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["role"] = [$"Unsupported role values: {string.Join(", ", invalidRoles)}."]
            });
        }

        await _usersRepository.UpdateUserRolesAsync(request.Updates, cancellationToken);
        return Results.NoContent();
    }
}
