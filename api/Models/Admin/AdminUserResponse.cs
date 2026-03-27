namespace Naologic_API.Models.Admin;

public sealed record AdminUserResponse(
    Guid UserId,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    bool IsActive,
    DateTime CreatedAt);
