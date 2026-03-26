using Microsoft.Data.SqlClient;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.WithOrigins("http://localhost:4200")
              .AllowAnyHeader()
              .AllowAnyMethod());
});
builder.Services.AddSingleton<WorkOrdersRepository>();

var app = builder.Build();

app.UseCors();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

// Collection endpoint for the static work-center rows shown on the timeline.
app.MapGet("/api/work-centers", async (WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var workCenters = await repository.GetWorkCentersAsync(cancellationToken);
    return Results.Ok(workCenters);
});

// Collection endpoint for loading every work order rendered in the grid.
app.MapGet("/api/work-orders", async (WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var workOrders = await repository.GetWorkOrdersAsync(cancellationToken);
    return Results.Ok(workOrders);
});

// POST targets the collection URL because it creates a brand new work-order resource.
app.MapPost("/api/work-orders", async (CreateWorkOrderRequest request, WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var validationError = ValidateRequest(request);
    if (validationError is not null)
    {
        return Results.ValidationProblem(validationError);
    }

    var created = await repository.CreateWorkOrderAsync(request, cancellationToken);
    return created is null
        ? Results.BadRequest(new { message = "Unknown work center." })
        : Results.Created($"/api/work-orders/{created.DocId}", created);
});

// PUT targets a single resource URL, so `/api/work-orders/wo-007` means "update work order wo-007".
app.MapPut("/api/work-orders/{id}", async (string id, UpdateWorkOrderRequest request, WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var validationError = ValidateRequest(request);
    if (validationError is not null)
    {
        return Results.ValidationProblem(validationError);
    }

    var updated = await repository.UpdateWorkOrderAsync(id, request, cancellationToken);
    return updated is null
        ? Results.NotFound()
        : Results.Ok(updated);
});

app.MapDelete("/api/work-orders/{id}", async (string id, WorkOrdersRepository repository, CancellationToken cancellationToken) =>
{
    var deleted = await repository.DeleteWorkOrderAsync(id, cancellationToken);
    return deleted ? Results.NoContent() : Results.NotFound();
});

app.Run();

static Dictionary<string, string[]>? ValidateRequest(WorkOrderMutationRequest request)
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

sealed record WorkCenterData(string Name);

sealed record WorkOrderData(string Name, string WorkCenterId, string Status, string StartDate, string EndDate);

sealed record WorkCenterDocument(string DocId, string DocType, WorkCenterData Data);

sealed record WorkOrderDocument(string DocId, string DocType, WorkOrderData Data);

abstract record WorkOrderMutationRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate);

sealed record CreateWorkOrderRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate)
    : WorkOrderMutationRequest(Name, WorkCenterId, Status, StartDate, EndDate);

sealed record UpdateWorkOrderRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate)
    : WorkOrderMutationRequest(Name, WorkCenterId, Status, StartDate, EndDate);

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
