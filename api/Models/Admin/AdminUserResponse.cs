namespace Naologic_API.Models.Admin;

public sealed record AdminUserResponse(
    Guid UserId,
    string Email,
    string FirstName,
    string LastName,
    string Role,
    bool IsActive,
    DateTime CreatedAt);

public sealed record UpdateUserRoleItemRequest(Guid UserId, string Role);

public sealed record UpdateUserRolesRequest(IReadOnlyList<UpdateUserRoleItemRequest> Updates);
