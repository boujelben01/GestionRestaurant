using System.Net;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Resto.Tests;

// Réglages de déploiement (Render) : CORS lu depuis Cors__AllowedOrigins, arrêt explicite si un réglage obligatoire manque.
public class DeploymentTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static async Task<string?> AllowedOriginAsync(WebApplicationFactory<Program> app, string origin)
    {
        using var request = new HttpRequestMessage(HttpMethod.Options, "health");
        request.Headers.Add("Origin", origin);
        request.Headers.Add("Access-Control-Request-Method", "GET");
        var response = await app.CreateClient().SendAsync(request);
        return response.Headers.TryGetValues("Access-Control-Allow-Origin", out var values) ? values.Single() : null;
    }

    [Fact]
    public async Task Cors_origins_come_from_a_comma_separated_setting()
    {
        var app = factory.WithWebHostBuilder(b =>
            b.UseSetting("Cors:AllowedOrigins", " https://el-resto.example.com/ , https://www.el-resto.example.com"));

        Assert.Equal("https://el-resto.example.com", await AllowedOriginAsync(app, "https://el-resto.example.com"));
        Assert.Equal("https://www.el-resto.example.com", await AllowedOriginAsync(app, "https://www.el-resto.example.com"));
        Assert.Null(await AllowedOriginAsync(app, "https://autre.example.com"));
    }

    [Fact]
    public async Task Outside_development_without_setting_no_origin_is_allowed()
    {
        Assert.Null(await AllowedOriginAsync(factory, "http://localhost:5173"));
    }

    [Fact]
    public async Task Wildcard_is_never_honoured()
    {
        var app = factory.WithWebHostBuilder(b => b.UseSetting("Cors:AllowedOrigins", "*"));

        Assert.Null(await AllowedOriginAsync(app, "https://autre.example.com"));
    }

    [Fact]
    public async Task Health_answers_without_database_or_https_redirection()
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Add("X-Forwarded-Proto", "https");

        var response = await client.GetAsync("health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public void Missing_connection_string_stops_startup_with_its_name()
    {
        var app = factory.WithWebHostBuilder(b => b.UseSetting("ConnectionStrings:Default", ""));

        var ex = Record.Exception(() => app.CreateClient());

        Assert.NotNull(ex);
        Assert.Contains("ConnectionStrings__Default", ex.ToString());
    }

    [Fact]
    public void Short_jwt_key_stops_startup_with_its_name_but_not_its_value()
    {
        const string tooShort = "cle-trop-courte";
        var app = factory.WithWebHostBuilder(b => b.UseSetting("Jwt:SecretKey", tooShort));

        var ex = Record.Exception(() => app.CreateClient());

        Assert.NotNull(ex);
        Assert.Contains("Jwt__SecretKey", ex.ToString());
        Assert.DoesNotContain(tooShort, ex.ToString());
    }
}
