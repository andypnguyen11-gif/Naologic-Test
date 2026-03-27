using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Naologic_API.Models.WorkOrders;
using Naologic_API.Repositories;
using Naologic_API.Validation;

namespace Naologic_API.Controllers;

[ApiController]
[Authorize]
[Route("api")]
public sealed class WorkOrdersController : ControllerBase
{
    private readonly WorkOrdersRepository _repository;

    public WorkOrdersController(WorkOrdersRepository repository)
    {
        _repository = repository;
    }

    [HttpGet("work-centers")]
    public async Task<ActionResult<IReadOnlyList<WorkCenterDocument>>> GetWorkCenters(CancellationToken cancellationToken)
    {
        var workCenters = await _repository.GetWorkCentersAsync(cancellationToken);
        return Ok(workCenters);
    }

    [HttpGet("work-orders")]
    public async Task<ActionResult<IReadOnlyList<WorkOrderDocument>>> GetWorkOrders(CancellationToken cancellationToken)
    {
        var workOrders = await _repository.GetWorkOrdersAsync(cancellationToken);
        return Ok(workOrders);
    }

    [Authorize(Policy = "PlannerWriteAccess")]
    [HttpPost("work-orders")]
    public async Task<IResult> CreateWorkOrder([FromBody] CreateWorkOrderRequest request, CancellationToken cancellationToken)
    {
        var validationError = WorkOrderValidators.ValidateWorkOrderRequest(request);
        if (validationError is not null)
        {
            return Results.ValidationProblem(validationError);
        }

        var created = await _repository.CreateWorkOrderAsync(request, cancellationToken);
        return created is null
            ? Results.BadRequest(new { message = "Unknown work center." })
            : Results.Created($"/api/work-orders/{created.DocId}", created);
    }

    [Authorize(Policy = "PlannerWriteAccess")]
    [HttpPut("work-orders/{id}")]
    public async Task<IResult> UpdateWorkOrder(string id, [FromBody] UpdateWorkOrderRequest request, CancellationToken cancellationToken)
    {
        var validationError = WorkOrderValidators.ValidateWorkOrderRequest(request);
        if (validationError is not null)
        {
            return Results.ValidationProblem(validationError);
        }

        var updated = await _repository.UpdateWorkOrderAsync(id, request, cancellationToken);
        return updated is null
            ? Results.NotFound()
            : Results.Ok(updated);
    }

    [Authorize(Policy = "PlannerWriteAccess")]
    [HttpDelete("work-orders/{id}")]
    public async Task<IActionResult> DeleteWorkOrder(string id, CancellationToken cancellationToken)
    {
        var deleted = await _repository.DeleteWorkOrderAsync(id, cancellationToken);
        return deleted ? NoContent() : NotFound();
    }
}
