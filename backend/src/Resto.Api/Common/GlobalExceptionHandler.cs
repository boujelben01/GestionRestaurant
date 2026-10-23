using System.Diagnostics;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Resto.Api.Common;

public class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger, IProblemDetailsService problemDetails)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        var details = Classify(exception);
        httpContext.Response.StatusCode = details.Status ?? StatusCodes.Status500InternalServerError;

        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = details
        });
    }

    private ProblemDetails Classify(Exception exception)
    {
        switch (exception)
        {
            case AppException { Field: not null } app:
                return new ValidationProblemDetails(new Dictionary<string, string[]> { [app.Field!] = [app.Message] })
                {
                    Status = app.Status,
                    Title = "Une ou plusieurs erreurs de validation se sont produites."
                };
            case AppException app:
                return new ProblemDetails { Status = app.Status, Title = app.Message };
            case DbUpdateException { InnerException: PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } }:
                logger.LogWarning(exception, "Violation de contrainte d'unicité.");
                return new ProblemDetails { Status = StatusCodes.Status409Conflict, Title = "Cette valeur existe déjà." };
            case DbUpdateConcurrencyException:
                logger.LogWarning(exception, "Conflit de concurrence.");
                return new ProblemDetails
                {
                    Status = StatusCodes.Status409Conflict,
                    Title = "La ressource a été modifiée entre-temps. Rechargez-la et réessayez."
                };
            default:
                var correlationId = Activity.Current?.TraceId.ToString() ?? Guid.NewGuid().ToString("N");
                logger.LogError(exception, "Erreur non gérée (correlationId {CorrelationId})", correlationId);
                return new ProblemDetails
                {
                    Status = StatusCodes.Status500InternalServerError,
                    Title = "Une erreur interne est survenue.",
                    Extensions = { ["correlationId"] = correlationId }
                };
        }
    }
}
