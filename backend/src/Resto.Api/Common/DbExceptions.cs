using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Resto.Api.Common;

public static class DbExceptions
{
    public static bool IsUniqueViolation(this DbUpdateException exception) =>
        exception.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };
}
