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
}
