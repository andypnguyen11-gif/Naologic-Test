using Microsoft.Data.SqlClient;
using Naologic_API.Constants;
using Naologic_API.Models.Admin;
using Naologic_API.Models.Auth;

namespace Naologic_API.Repositories;

public sealed class UsersRepository
{
    private readonly string _connectionString;

    public UsersRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
    }

    public async Task<AppUserAccount?> GetByEmailAsync(string email, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT UserId, Email, PasswordHash, FirstName, LastName, Role, IsActive, CreatedAt
            FROM Users
            WHERE LOWER(Email) = LOWER(@email);
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@email", email.Trim());
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        return await reader.ReadAsync(cancellationToken)
            ? MapUser(reader)
            : null;
    }

    public async Task<AppUserAccount?> GetByIdAsync(Guid userId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT UserId, Email, PasswordHash, FirstName, LastName, Role, IsActive, CreatedAt
            FROM Users
            WHERE UserId = @userId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@userId", userId);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        return await reader.ReadAsync(cancellationToken)
            ? MapUser(reader)
            : null;
    }

    public async Task<IReadOnlyList<AdminUserResponse>> GetAllUsersAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT UserId, Email, FirstName, LastName, Role, IsActive, CreatedAt
            FROM Users
            ORDER BY CreatedAt DESC, Email;
            """;

        var users = new List<AdminUserResponse>();
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            users.Add(new AdminUserResponse(
                reader.GetGuid(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.GetString(4),
                reader.GetBoolean(5),
                reader.GetDateTime(6)));
        }

        return users;
    }

    public async Task<AppUserAccount> CreateUserAsync(AppUserAccount user, CancellationToken cancellationToken)
    {
        const string sql = """
            INSERT INTO Users (UserId, Email, PasswordHash, FirstName, LastName, Role, IsActive, CreatedAt)
            VALUES (@userId, @email, @passwordHash, @firstName, @lastName, @role, @isActive, @createdAt);
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@userId", user.UserId);
        command.Parameters.AddWithValue("@email", user.Email);
        command.Parameters.AddWithValue("@passwordHash", user.PasswordHash);
        command.Parameters.AddWithValue("@firstName", user.FirstName);
        command.Parameters.AddWithValue("@lastName", user.LastName);
        command.Parameters.AddWithValue("@role", user.Role);
        command.Parameters.AddWithValue("@isActive", user.IsActive);
        command.Parameters.AddWithValue("@createdAt", user.CreatedAt);
        await command.ExecuteNonQueryAsync(cancellationToken);

        return user;
    }

    public async Task UpdateUserRolesAsync(IReadOnlyList<UpdateUserRoleItemRequest> updates, CancellationToken cancellationToken)
    {
        if (updates.Count == 0)
        {
            return;
        }

        const string sql = """
            UPDATE Users
            SET Role = @role
            WHERE UserId = @userId;
            """;

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var transaction = await connection.BeginTransactionAsync(cancellationToken);

        foreach (var update in updates)
        {
          if (!AllowedRoles.Contains(update.Role))
          {
              throw new InvalidOperationException($"Unsupported role value '{update.Role}'.");
          }

          await using var command = new SqlCommand(sql, connection, transaction as SqlTransaction);
          command.Parameters.AddWithValue("@role", update.Role);
          command.Parameters.AddWithValue("@userId", update.UserId);
          await command.ExecuteNonQueryAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    private static readonly HashSet<string> AllowedRoles =
    [
        UserRoles.Admin,
        UserRoles.Planner,
        UserRoles.Viewer
    ];

    private static AppUserAccount MapUser(SqlDataReader reader)
    {
        return new AppUserAccount(
            reader.GetGuid(0),
            reader.GetString(1),
            reader.GetString(2),
            reader.GetString(3),
            reader.GetString(4),
            reader.GetString(5),
            reader.GetBoolean(6),
            reader.GetDateTime(7));
    }
}
