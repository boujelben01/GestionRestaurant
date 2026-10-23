namespace Resto.Api.Common;

/// <summary>Erreur attendue dont le message est destiné au client (404, 409, 400 de validation métier).</summary>
public class AppException(int status, string message, string? field = null) : Exception(message)
{
    public int Status { get; } = status;
    public string? Field { get; } = field;

    public static AppException NotFound(string message = "Ressource introuvable.") =>
        new(StatusCodes.Status404NotFound, message);

    public static AppException Conflict(string message) =>
        new(StatusCodes.Status409Conflict, message);

    public static AppException Invalid(string field, string message) =>
        new(StatusCodes.Status400BadRequest, message, field);
}
