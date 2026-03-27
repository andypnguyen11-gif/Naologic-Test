namespace Naologic_API.Models.WorkOrders;

public sealed record WorkCenterData(string Name);

public sealed record WorkOrderData(string Name, string WorkCenterId, string Status, string StartDate, string EndDate);

public sealed record WorkCenterDocument(string DocId, string DocType, WorkCenterData Data);

public sealed record WorkOrderDocument(string DocId, string DocType, WorkOrderData Data);

public abstract record WorkOrderMutationRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate);

public sealed record CreateWorkOrderRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate)
    : WorkOrderMutationRequest(Name, WorkCenterId, Status, StartDate, EndDate);

public sealed record UpdateWorkOrderRequest(string Name, string WorkCenterId, string Status, string StartDate, string EndDate)
    : WorkOrderMutationRequest(Name, WorkCenterId, Status, StartDate, EndDate);
