using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Naologic_API.Constants;
using Naologic_API.Models.Auth;
using Naologic_API.Repositories;
using Naologic_API.Services;
using Naologic_API.Validation;

namespace Naologic_API.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly UsersRepository _usersRepository;
    private readonly IPasswordHasher<AppUserAccount> _passwordHasher;
    private readonly JwtTokenService _tokenService;

    public AuthController(
        UsersRepository usersRepository,
        IPasswordHasher<AppUserAccount> passwordHasher,
        JwtTokenService tokenService)
    {
        _usersRepository = usersRepository;
        _passwordHasher = passwordHasher;
        _tokenService = tokenService;
    }

    [HttpPost("signup")]
    public async Task<IResult> Signup([FromBody] SignupRequest request, CancellationToken cancellationToken)
    {
        var validationError = AuthValidators.ValidateSignupRequest(request);
        if (validationError is not null)
        {
            return Results.ValidationProblem(validationError);
        }

        var existingUser = await _usersRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (existingUser is not null)
        {
            return Results.Conflict(new { message = "An account with that email already exists." });
        }

        var user = new AppUserAccount(
            Guid.NewGuid(),
            request.Email.Trim(),
            string.Empty,
            request.FirstName.Trim(),
            request.LastName.Trim(),
            UserRoles.Admin,
            true,
            DateTime.UtcNow);

        var passwordHash = _passwordHasher.HashPassword(user, request.Password);
        var createdUser = await _usersRepository.CreateUserAsync(user with { PasswordHash = passwordHash }, cancellationToken);

        var response = _tokenService.CreateAuthResponse(createdUser);
        return Results.Created("/api/auth/me", response);
    }

    [HttpPost("login")]
    public async Task<IResult> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var validationError = AuthValidators.ValidateLoginRequest(request);
        if (validationError is not null)
        {
            return Results.ValidationProblem(validationError);
        }

        var user = await _usersRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (user is null || !user.IsActive)
        {
            return Results.Unauthorized();
        }

        var verificationResult = _passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
        if (verificationResult == PasswordVerificationResult.Failed)
        {
            return Results.Unauthorized();
        }

        var response = _tokenService.CreateAuthResponse(user);
        return Results.Ok(response);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IResult> Me(CancellationToken cancellationToken)
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim, out var userId))
        {
            return Results.Unauthorized();
        }

        var user = await _usersRepository.GetByIdAsync(userId, cancellationToken);
        return user is null || !user.IsActive
            ? Results.Unauthorized()
            : Results.Ok(new AuthUserResponse(user.UserId, user.Email, user.FirstName, user.LastName, user.Role));
    }
}
