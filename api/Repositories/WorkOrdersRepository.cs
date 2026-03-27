using Microsoft.Data.SqlClient;
using Naologic_API.Models.WorkOrders;

namespace Naologic_API.Repositories;

public sealed class WorkOrdersRepository
{
    public static readonly string[] AllowedStatuses = ["open", "in-progress", "complete", "blocked"];
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
        if (!await WorkCenterExistsAsync(request.WorkCenterId, cancellationToken))
        {
            return null;
        }

        var workOrderId = $"wo-{Guid.NewGuid():N}"[..11];

        const string sql = """
            INSERT INTO WorkOrders (WorkOrderId, Name, WorkCenterId, Status, StartDate, EndDate)
            VALUES (@workOrderId, @name, @workCenterId, @status, @startDate, @endDate);
            """;

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

        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@workCenterId", workCenterId);
        var count = (int)await command.ExecuteScalarAsync(cancellationToken);
        return count > 0;
    }
}
