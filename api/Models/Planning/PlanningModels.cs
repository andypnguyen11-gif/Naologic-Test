namespace Naologic_API.Models.Planning;

public sealed record ComponentGapDocument(
    string ComponentPartId,
    string PartNumber,
    string ComponentName,
    string PartType,
    string? WorkCenterId,
    string? WorkCenterName,
    decimal QuantityPer,
    decimal TargetQuantity,
    decimal QuantityRequired,
    decimal QuantityOnHand,
    decimal QuantityAllocated,
    decimal QuantityOnOrder,
    decimal QuantityAvailable,
    decimal Shortage,
    int StandardBuildDays,
    int StandardLeadDays,
    int ProjectedReadyDays);
