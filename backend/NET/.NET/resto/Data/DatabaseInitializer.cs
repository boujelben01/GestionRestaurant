using Microsoft.EntityFrameworkCore;

namespace resto.Data
{
    public class DatabaseInitializer : IHostedService
    {
        private readonly IServiceProvider _services;

        public DatabaseInitializer(IServiceProvider services)
        {
            _services = services;
        }

        public async Task StartAsync(CancellationToken cancellationToken)
        {
            using var scope = _services.CreateScope();
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await context.Database.MigrateAsync(cancellationToken);
            await scope.ServiceProvider.GetRequiredService<DbSeeder>().SeedAsync();
        }

        public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
    }
}
