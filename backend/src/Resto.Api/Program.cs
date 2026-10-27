using System.Text.Json.Serialization;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.OpenApi.Models;
using Resto.Api.Common;
using Resto.Api.Data;
using Resto.Api.Data.Catalogue;
using Resto.Api.Data.Demo;
using Resto.Api.Domain;
using Resto.Api.Features.Auth;
using Resto.Api.Features.Adresses;
using Resto.Api.Features.Commandes;
using Resto.Api.Features.Commandes.Admin;
using Resto.Api.Features.Favoris;
using Resto.Api.Features.Menu;
using Resto.Api.Features.Menu.Admin;
using Resto.Api.Features.Panier;
using Resto.Api.Features.Restaurant;
using Resto.Api.Features.Statistiques;
using Resto.Api.Features.Tables;

var builder = WebApplication.CreateBuilder(args);

// Seul le NOM du réglage est cité, jamais sa valeur.
var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Réglage obligatoire manquant : ConnectionStrings:Default (variable d'environnement ConnectionStrings__Default).");
}

// Render (et l'image Docker) donnent le port d'écoute dans PORT ; sans PORT, rien ne change (launchSettings en local).
if (int.TryParse(builder.Configuration["PORT"], out var port))
{
    builder.WebHost.UseUrls($"http://+:{port}");
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure()));

builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.User.RequireUniqueEmail = true;
        options.Password.RequiredLength = 8;
        options.Lockout.MaxFailedAccessAttempts = 5;
        options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(10);
    })
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<AppDbContext>()
    .AddSignInManager();

builder.Services.AddJwtAuthentication(builder.Configuration);
builder.Services.AddAuthRateLimiting();

builder.Services.AddScoped<MenuService>();
builder.Services.AddScoped<CategorieAdminService>();
builder.Services.AddScoped<ArticleAdminService>();
builder.Services.AddScoped<RestaurantService>();
builder.Services.AddScoped<PanierService>();
builder.Services.AddScoped<CommandeService>();
builder.Services.AddScoped<CommandeAdminService>();
builder.Services.AddScoped<TableAdminService>();
builder.Services.AddScoped<SalleService>();
builder.Services.AddScoped<StatistiquesService>();
builder.Services.AddScoped<FavoriService>();
builder.Services.AddScoped<AdresseService>();

// Cors:AllowedOrigins : liste séparée par des virgules (variable Cors__AllowedOrigins) ou tableau (user-secrets).
// Sans réglage : origine locale en Development, aucune ailleurs (jamais AllowAnyOrigin, « * » est ignoré).
var corsSection = builder.Configuration.GetSection("Cors:AllowedOrigins");
var allowedOrigins = (corsSection.Value?.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        ?? corsSection.Get<string[]>()
        ?? (builder.Environment.IsDevelopment() ? ["http://localhost:5173"] : []))
    .Select(origin => origin.TrimEnd('/'))
    .Where(origin => origin is not ("" or "*"))
    .ToArray();
builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
    .WithOrigins(allowedOrigins)
    .WithMethods("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")
    .WithHeaders("Authorization", "Content-Type", "Accept")));

// Derrière le proxy de Render (TLS terminé par lui) : schéma et IP client lus dans X-Forwarded-Proto / X-Forwarded-For.
// Les IP du proxy ne sont pas connues à l'avance ; ForwardLimit = 1 ne retient que l'entrée ajoutée par le proxy.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddControllers()
    .AddJsonOptions(options => options.JsonSerializerOptions.Converters.Add(
        new JsonStringEnumConverter(namingPolicy: null, allowIntegerValues: false)));
builder.Services.AddHealthChecks();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Jeton JWT."
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// Les migrations ne s'appliquent QUE par cette commande, jamais au démarrage.
if (MigrateCommand.IsRequested(args))
{
    using var migrateScope = app.Services.CreateScope();
    Environment.ExitCode = await MigrateCommand.RunAsync(
        args, migrateScope.ServiceProvider.GetRequiredService<AppDbContext>(), Console.Out);
    return;
}

if (CatalogueCommand.IsRequested(args))
{
    using var catalogueScope = app.Services.CreateScope();
    Environment.ExitCode = await CatalogueCommand.RunAsync(
        args, catalogueScope.ServiceProvider.GetRequiredService<AppDbContext>(), CatalogueReader.DefaultPath, Console.Out);
    return;
}

if (DemoCommand.IsRequested(args))
{
    using var demoScope = app.Services.CreateScope();
    Environment.ExitCode = await DemoCommand.RunAsync(
        args,
        demoScope.ServiceProvider.GetRequiredService<AppDbContext>(),
        demoScope.ServiceProvider.GetRequiredService<UserManager<ApplicationUser>>(),
        app.Configuration[DemoCommand.PasswordKey],
        app.Environment.EnvironmentName,
        DemoReader.DefaultPath,
        Console.Out,
        DateTimeOffset.UtcNow);
    return;
}

var seedRequested = args.Contains("--seed");
if (app.Environment.IsDevelopment() || seedRequested)
{
    using var scope = app.Services.CreateScope();
    await DbSeeder.SeedAsync(scope.ServiceProvider);
    if (seedRequested)
    {
        return;
    }
}

if (!app.Environment.IsDevelopment())
{
    app.UseForwardedHeaders();
}

app.UseExceptionHandler();

// Pas de UseHttpsRedirection : le proxy (Render) force déjà HTTPS ; une redirection interne bouclerait.
if (!app.Environment.IsDevelopment())
{
    app.UseHsts();
}

app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    await next();
});

app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
// Aucun contrôle enregistré : /health répond 200 sans interroger la base (réveil et health check de Render).
app.MapHealthChecks("/health").AllowAnonymous();

app.Run();

public partial class Program;
