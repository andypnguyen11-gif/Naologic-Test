using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Naologic_API.Models.Planning;
using Naologic_API.Repositories;

namespace Naologic_API.Controllers;

[ApiController]
[Authorize]
[Route("api/planning")]
public sealed class PlanningController : ControllerBase
{
    private readonly PlanningRepository _repository;

    public PlanningController(PlanningRepository repository)
    {
        _repository = repository;
    }

    [HttpGet("component-gaps")]
    public async Task<ActionResult<IReadOnlyList<ComponentGapDocument>>> GetComponentGaps(
        [FromQuery] string partId,
        [FromQuery] int targetQty,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(partId))
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["partId"] = ["partId is required."]
            }));
        }

        if (targetQty <= 0)
        {
            return BadRequest(new ValidationProblemDetails(new Dictionary<string, string[]>
            {
                ["targetQty"] = ["targetQty must be greater than zero."]
            }));
        }

        var componentGaps = await _repository.GetComponentGapsAsync(partId.Trim(), targetQty, cancellationToken);
        return Ok(componentGaps);
    }
}
