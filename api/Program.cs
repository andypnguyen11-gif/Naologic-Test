using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.Data.SqlClient;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod());
});

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var jwtSettings = builder.Configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
            ?? throw new InvalidOperationException("Jwt settings are not configured.");
        var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SigningKey));

        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidateAudience = true,
            ValidAudience = jwtSettings.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = signingKey,
            ValidateLifetime = true,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("PlannerWriteAccess", policy =>
        policy.RequireRole(UserRoles.Admin, UserRoles.Planner));

builder.Services.AddSingleton<WorkOrdersRepository>();
builder.Services.AddSingleton<UsersRepository>();
builder.Services.AddSingleton<IPasswordHasher<AppUserAccount>, PasswordHasher<AppUserAccount>>();
builder.Services.AddSingleton<JwtTokenService>();

var app = builder.Build();

app.UseCors();
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

var authGroup = app.MapGroup("/api/auth");

// Signup is intentionally open, and new self-registered users currently start as Admin.
authGroup.MapPost("/signup", async (
    SignupRequest request,
    UsersRepository usersRepository,
    IPasswordHasher<AppUserAccount> passwordHasher,
    JwtTokenService tokenService,
    CancellationToken cancellationToken) =>
{
    var validationError = ValidateSignupRequest(request);
    if (validationError is not null)
    {
        return Results.ValidationProblem(validationError);
    }

    var existingUser = await usersRepository.GetByEmailAsync(request.Email, cancellationToken);
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

    var passwordHash = passwordHasher.HashPassword(user, request.Password);
    var createdUser = await usersRepository.CreateUserAsync(user with { PasswordHash = passwordHash }, cancellationToken);

    var response = tokenService.CreateAuthResponse(createdUser);
    return Results.Created("/api/auth/me", response);
});

authGroup.MapPost("/login", async (
    LoginRequest request,
    UsersRepository usersRepository,
    IPasswordHasher<AppUserAccount> passwordHasher,
    JwtTokenService tokenService,
    CancellationToken cancellationToken) =>
{
    var validationError = ValidateLoginRequest(request);
    if (validationError is not null)
    {
        return Results.ValidationProblem(validationError);
    }

    var user = await usersRepository.GetByEmailAsync(request.Email, cancellationToken);
    if (user is null || !user.IsActive)
    {
        return Results.Unauthorized();
    }

    var verificationResult = passwordHasher.VerifyHashedPassword(user, user.PasswordHash, request.Password);
    if (verificationResult == PasswordVerificationResult.Failed)
    {
        return Results.Unauthorized();
    }

    var response = tokenService.CreateAuthResponse(user);
    return Results.Ok(response);
});

// `me` gives the frontend a stable way to restore the signed-in user after refresh.
authGroup.MapGet("/me", async (
    ClaimsPrincipal principal,
    UsersRepository usersRepository,
    CancellationToken cancellationToken) =>
{
    var userIdClaim = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!Guid.TryParse(userIdClaim, out var userId))
    {
        return Results.Unauthorized();
    }

    var user = await usersRepository.GetByIdAsync(userId, cancellationToken);
    return user is null || !user.IsActive
        ? Results.Unauthorized()
        : Results.Ok(new AuthUserResponse(user.UserId, user.Email, user.FirstName, user.LastName, user.Role));
}).RequireAuthorization();

var workOrdersGroup = app.MapGroup("/api").RequireAuthorization();

// Collection endpoint for the static work-center rows shown on the timeline.
workOrdersGroup.MapGet("/work-centers", async (WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var workCenters = await repository.GetWorkCentersAsync(cancellationToken);
    return Results.Ok(workCenters);
});

// Collection endpoint for loading every work order rendered in the grid.
workOrdersGroup.MapGet("/work-orders", async (WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var workOrders = await repository.GetWorkOrdersAsync(cancellationToken);
    return Results.Ok(workOrders);
});

// POST targets the collection URL because it creates a brand new work-order resource.
workOrdersGroup.MapPost("/work-orders", async (CreateWorkOrderRequest request, WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var validationError = ValidateWorkOrderRequest(request);
    if (validationError is not null)
    {
        return Results.ValidationProblem(validationError);
    }

    var created = await repository.CreateWorkOrderAsync(request, cancellationToken);
    return created is null
        ? Results.BadRequest(new { message = "Unknown work center." })
        : Results.Created($"/api/work-orders/{created.DocId}", created);
}).RequireAuthorization("PlannerWriteAccess");

// PUT targets a single resource URL, so `/api/work-orders/wo-007` means "update work order wo-007".
workOrdersGroup.MapPut("/work-orders/{id}", async (string id, UpdateWorkOrderRequest request, WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var validationError = ValidateWorkOrderRequest(request);
    if (validationError is not null)
    {
        return Results.ValidationProblem(validationError);
    }

    var updated = await repository.UpdateWorkOrderAsync(id, request, cancellationToken);
    return updated is null
        ? Results.NotFound()
        : Results.Ok(updated);
}).RequireAuthorization("PlannerWriteAccess");

workOrdersGroup.MapDelete("/work-orders/{id}", async (string id, WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var deleted = await repository.DeleteWorkOrderAsync(id, cancellationToken);
    return deleted ? Results.NoContent() : Results.NotFound();
}).RequireAuthorization("PlannerWriteAccess");

app.Run();

static Dictionary<string, string[]>? ValidateWorkOrderRequest(WorkOrderMutationRequest request)
{
    // Keep input validation at the API boundary so bad payloads never reach SQL.
    var errors = new Dictionary<string, string[]>();
    if (string.IsNullOrWhiteSpace(request.Name))
    {
        errors["name"] = ["Name is required."];
    }

    if (string.IsNullOrWhiteSpace(request.WorkCenterId))
    {
        errors["workCenterId"] = ["Work center is required."];
    }

    if (!WorkOrdersRepository.AllowedStatuses.Contains(request.Status))
    {
        errors["status"] = [$"Status must be one of: {string.Join(", ", WorkOrdersRepository.AllowedStatuses)}."];
    }

    if (!DateOnly.TryParse(request.StartDate, out var startDate))
    {
        errors["startDate"] = ["Start date must be a valid ISO date string (yyyy-MM-dd)."];
    }

    if (!DateOnly.TryParse(request.EndDate, out var endDate))
    {
        errors["endDate"] = ["End date must be a valid ISO date string (yyyy-MM-dd)."];
    }

    if (!errors.ContainsKey("startDate") && !errors.ContainsKey("endDate") && startDate > endDate)
    {
        errors["dateRange"] = ["End date must be on or after start date."];
    }

    return errors.Count > 0 ? errors : null;
}

static Dictionary<string, string[]>? ValidateSignupRequest(SignupRequest request)
{
    var errors = ValidateLoginRequest(new LoginRequest(request.Email, request.Password)) ?? new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.FirstName))
    {
        errors["firstName"] = ["First name is required."];
    }

    if (string.IsNullOrWhiteSpace(request.LastName))
    {
        errors["lastName"] = ["Last name is required."];
    }

    return errors.Count > 0 ? errors : null;
}

static Dictionary<string, string[]>? ValidateLoginRequest(LoginRequest request)
{
    var errors = new Dictionary<string, string[]>();

    if (string.IsNullOrWhiteSpace(request.Email))
    {
        errors["email"] = ["Email is required."];
    }
    else if (!request.Email.Contains('@'))
    {
        errors["email"] = ["Email must be valid."];
    }

    if (string.IsNullOrWhiteSpace(request.Password))
    {
        errors["password"] = ["Password is required."];
    }
    else if (request.Password.Length < 8)
    {
        errors["password"] = ["Password must be at least 8 characters long."];
    }

    return errors.Count > 0 ? errors : null;
}

static class UserRoles
{
    public const string Admin = "Admin";
    public const string Planner = "Planner";
    public const string Viewer = "Viewer";
}

sealed record JwtSettings(string Issuer, string Audience, string SigningKey)
{
    public const string SectionName = "Jwt";
}

sealed record WorkCenterData(string Name);

sealed record WorkOrderData(string Name, string WorkCenterId, string Status, string StartDate, string EndDate);

sealed record WorkCenterDocument(string DocId, string DocType, WorkCenterData Data);

sealed record WorkOrderDocument(string DocId, string DocType, WorkOrderData Data);

abstract record WorkOrderMutationRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate);

sealed record CreateWorkOrderRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate)
    : WorkOrderMutationRequest(Name, WorkCenterId, Status, StartDate, EndDate);

sealed record UpdateWorkOrderRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate)
    : WorkOrderMutationRequest(Name, WorkCenterId, Status, StartDate, EndDate);

sealed record SignupRequest(string Email, string Password, string FirstName, string LastName);

sealed record LoginRequest(string Email, string Password);

sealed record AuthUserResponse(Guid UserId, string Email, string FirstName, string LastName, string Role);

sealed record AuthResponse(string Token, AuthUserResponse User);

sealed record AppUserAccount(
    Guid UserId,
    string Email,
    string PasswordHash,
    string FirstName,
    string LastName,
    string Role,
    bool IsActive,
    DateTime CreatedAt);

sealed class JwtTokenService
{
    private readonly JwtSettings _jwtSettings;

    public JwtTokenService(IConfiguration configuration)
    {
        _jwtSettings = configuration.GetSection(JwtSettings.SectionName).Get<JwtSettings>()
            ?? throw new InvalidOperationException("Jwt settings are not configured.");
    }

    public AuthResponse CreateAuthResponse(AppUserAccount user)
    {
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.UserId.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.GivenName, user.FirstName),
            new(ClaimTypes.Surname, user.LastName),
            new(ClaimTypes.Role, user.Role)
        };

        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwtSettings.SigningKey)),
            SecurityAlgorithms.HmacSha256);

        var tokenDescriptor = new JwtSecurityToken(
            issuer: _jwtSettings.Issuer,
            audience: _jwtSettings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(8),
            signingCredentials: credentials);

        var token = new JwtSecurityTokenHandler().WriteToken(tokenDescriptor);
        return new AuthResponse(token, new AuthUserResponse(user.UserId, user.Email, user.FirstName, user.LastName, user.Role));
    }
}

sealed class UsersRepository
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

sealed class WorkOrdersRepository
{
    internal static readonly string[] AllowedStatuses = ["open", "in-progress", "complete", "blocked"];
    private readonly string _connectionString;

    public WorkOrdersRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
    }

    public async Task<IReadOnlyList<WorkCenterDocument>> GetWorkCentersAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT WorkCenterId, Name
            FROM WorkCenters
            ORDER BY WorkCenterId;
            """;

        // Convert relational rows into the frontend document shape the Angular app already expects.
        var workCenters = new List<WorkCenterDocument>();
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            workCenters.Add(new WorkCenterDocument(
                reader.GetString(0),
                "workCenter",
                new WorkCenterData(reader.GetString(1))));
        }

        return workCenters;
    }

    public async Task<IReadOnlyList<WorkOrderDocument>> GetWorkOrdersAsync(CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT WorkOrderId, Name, WorkCenterId, Status, StartDate, EndDate
            FROM WorkOrders
            ORDER BY StartDate, WorkOrderId;
            """;

        // Read the full grid dataset from SQL in one pass for the initial page load.
        var workOrders = new List<WorkOrderDocument>();
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            workOrders.Add(new WorkOrderDocument(
                reader.GetString(0),
                "workOrder",
                new WorkOrderData(
                    reader.GetString(1),
                    reader.GetString(2),
                    reader.GetString(3),
                    reader.GetDateTime(4).ToString("yyyy-MM-dd"),
                    reader.GetDateTime(5).ToString("yyyy-MM-dd"))));
        }

        return workOrders;
    }

    public async Task<WorkOrderDocument?> CreateWorkOrderAsync(CreateWorkOrderRequest request, CancellationToken cancellationToken)
    {
        // Reject orphaned work orders before insert so the foreign-key failure stays user-friendly.
        if (!await WorkCenterExistsAsync(request.WorkCenterId, cancellationToken))
        {
            return null;
        }

        var workOrderId = $"wo-{Guid.NewGuid():N}"[..11];

        const string sql = """
            INSERT INTO WorkOrders (WorkOrderId, Name, WorkCenterId, Status, StartDate, EndDate)
            VALUES (@workOrderId, @name, @workCenterId, @status, @startDate, @endDate);
            """;

        // Parameterized SQL keeps the command safe and ensures dates are stored as real SQL DATE values.
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@workOrderId", workOrderId);
        command.Parameters.AddWithValue("@name", request.Name.Trim());
        command.Parameters.AddWithValue("@workCenterId", request.WorkCenterId);
        command.Parameters.AddWithValue("@status", request.Status);
        command.Parameters.AddWithValue("@startDate", DateOnly.Parse(request.StartDate).ToDateTime(TimeOnly.MinValue));
        command.Parameters.AddWithValue("@endDate", DateOnly.Parse(request.EndDate).ToDateTime(TimeOnly.MinValue));
        await command.ExecuteNonQueryAsync(cancellationToken);

        return new WorkOrderDocument(
            workOrderId,
            "workOrder",
            new WorkOrderData(
                request.Name.Trim(),
                request.WorkCenterId,
                request.Status,
                request.StartDate,
                request.EndDate));
    }

    public async Task<WorkOrderDocument?> UpdateWorkOrderAsync(string id, UpdateWorkOrderRequest request, CancellationToken cancellationToken)
    {
        // Keep the update path aligned with create: the target work center must still exist.
        if (!await WorkCenterExistsAsync(request.WorkCenterId, cancellationToken))
        {
            return null;
        }

        const string sql = """
            UPDATE WorkOrders
            SET Name = @name,
                WorkCenterId = @workCenterId,
                Status = @status,
                StartDate = @startDate,
                EndDate = @endDate
            WHERE WorkOrderId = @id;
            """;

        // The route `{id}` becomes `@id` here, which is why the URL identifies the row being updated.
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@id", id);
        command.Parameters.AddWithValue("@name", request.Name.Trim());
        command.Parameters.AddWithValue("@workCenterId", request.WorkCenterId);
        command.Parameters.AddWithValue("@status", request.Status);
        command.Parameters.AddWithValue("@startDate", DateOnly.Parse(request.StartDate).ToDateTime(TimeOnly.MinValue));
        command.Parameters.AddWithValue("@endDate", DateOnly.Parse(request.EndDate).ToDateTime(TimeOnly.MinValue));

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        if (rowsAffected == 0)
        {
            return null;
        }

        return new WorkOrderDocument(
            id,
            "workOrder",
            new WorkOrderData(
                request.Name.Trim(),
                request.WorkCenterId,
                request.Status,
                request.StartDate,
                request.EndDate));
    }

    public async Task<bool> DeleteWorkOrderAsync(string id, CancellationToken cancellationToken)
    {
        const string sql = """
            DELETE FROM WorkOrders
            WHERE WorkOrderId = @id;
            """;

        // A delete is successful only when SQL actually removes a matching row.
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@id", id);

        var rowsAffected = await command.ExecuteNonQueryAsync(cancellationToken);
        return rowsAffected > 0;
    }

    private async Task<bool> WorkCenterExistsAsync(string workCenterId, CancellationToken cancellationToken)
    {
        const string sql = """
            SELECT COUNT(1)
            FROM WorkCenters
            WHERE WorkCenterId = @workCenterId;
            """;

        // Small existence check used by create/update to avoid returning raw SQL foreign-key errors.
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@workCenterId", workCenterId);
        var count = (int)await command.ExecuteScalarAsync(cancellationToken);
        return count > 0;
    }
}
