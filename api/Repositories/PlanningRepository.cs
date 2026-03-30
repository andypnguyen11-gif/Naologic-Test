using Microsoft.Data.SqlClient;
using Naologic_API.Models.Planning;

namespace Naologic_API.Repositories;

public sealed class PlanningRepository
{
    private readonly string _connectionString;

    public PlanningRepository(IConfiguration configuration)
    {
        _connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("ConnectionStrings:DefaultConnection is not configured.");
    }

    public async Task<IReadOnlyList<ComponentGapDocument>> GetComponentGapsAsync(
        string partId,
        int targetQty,
        CancellationToken cancellationToken)
    {
        // Return one row per BOM component for the selected parent part, enriched with
        // inventory availability and planning calculations used by the frontend view.
        const string sql = """
            SELECT
                component.PartId AS ComponentPartId,
                component.PartNumber,
                component.Name AS ComponentName,
                component.PartType,
                component.DefaultWorkCenterId AS WorkCenterId,
                wc.Name AS WorkCenterName,
                bom.QuantityPer,
                CAST(@targetQty AS DECIMAL(12,2)) AS TargetQuantity,
                CAST(bom.QuantityPer * @targetQty AS DECIMAL(12,2)) AS QuantityRequired,
                ISNULL(inv.QuantityOnHand, 0) AS QuantityOnHand,
                ISNULL(inv.QuantityAllocated, 0) AS QuantityAllocated,
                ISNULL(inv.QuantityOnOrder, 0) AS QuantityOnOrder,
                -- Available quantity excludes stock already reserved by other demand.
                CAST(ISNULL(inv.QuantityOnHand, 0) - ISNULL(inv.QuantityAllocated, 0) AS DECIMAL(12,2)) AS QuantityAvailable,
                -- Shortage is clamped at zero so excess inventory does not produce a negative value.
                CASE
                    WHEN (bom.QuantityPer * @targetQty) - (ISNULL(inv.QuantityOnHand, 0) - ISNULL(inv.QuantityAllocated, 0)) > 0
                    THEN CAST((bom.QuantityPer * @targetQty) - (ISNULL(inv.QuantityOnHand, 0) - ISNULL(inv.QuantityAllocated, 0)) AS DECIMAL(12,2))
                    ELSE 0
                END AS Shortage,
                component.StandardBuildDays,
                component.StandardLeadDays,
                -- Manufactured parts use internal build time; purchased parts use supplier lead time.
                CASE
                    WHEN component.PartType IN ('manufactured', 'assembly', 'finished-good') THEN component.StandardBuildDays
                    ELSE component.StandardLeadDays
                END AS ProjectedReadyDays
            FROM BillOfMaterials bom
            INNER JOIN Parts parentPart
                ON parentPart.PartId = bom.ParentPartId
            INNER JOIN Parts component
                ON component.PartId = bom.ComponentPartId
            LEFT JOIN Inventory inv
                ON inv.PartId = component.PartId
            LEFT JOIN WorkCenters wc
                ON wc.WorkCenterId = component.DefaultWorkCenterId
            WHERE bom.ParentPartId = @partId
            ORDER BY Shortage DESC, component.Name;
            """;

        var componentGaps = new List<ComponentGapDocument>();
        await using var connection = new SqlConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@partId", partId);
        command.Parameters.AddWithValue("@targetQty", targetQty);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);

        while (await reader.ReadAsync(cancellationToken))
        {
            componentGaps.Add(new ComponentGapDocument(
                reader.GetString(0),
                reader.GetString(1),
                reader.GetString(2),
                reader.GetString(3),
                reader.IsDBNull(4) ? null : reader.GetString(4),
                reader.IsDBNull(5) ? null : reader.GetString(5),
                reader.GetDecimal(6),
                reader.GetDecimal(7),
                reader.GetDecimal(8),
                reader.GetDecimal(9),
                reader.GetDecimal(10),
                reader.GetDecimal(11),
                reader.GetDecimal(12),
                reader.GetDecimal(13),
                reader.GetInt32(14),
                reader.GetInt32(15),
                reader.GetInt32(16)));
        }

        return componentGaps;
    }
}
