namespace Naologic_API.Models.Auth;

public sealed record SignupRequest(string Email, string Password, string FirstName, string LastName);

public sealed record LoginRequest(string Email, string Password);

public sealed record AuthUserResponse(Guid UserId, string Email, string FirstName, string LastName, string Role);

public sealed record AuthResponse(string Token, AuthUserResponse User);

public sealed record AppUserAccount(
    Guid UserId,
    string Email,
    string PasswordHash,
    string FirstName,
    string LastName,
    string Role,
    bool IsActive,
    DateTime CreatedAt);
