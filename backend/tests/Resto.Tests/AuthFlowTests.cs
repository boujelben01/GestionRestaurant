using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Resto.Tests;

public class AuthFlowTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Fact]
    public async Task Login_succeeds_with_valid_credentials()
    {
        var client = await factory.CreateClientAsync();

        var response = await client.PostAsJsonAsync("api/auth/login", new { identifiant = "client", password = ApiFactory.Password });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.False(string.IsNullOrEmpty(json.RootElement.GetProperty("token").GetString()));
    }

    [Fact]
    public async Task Login_error_is_identical_for_unknown_user_and_wrong_password()
    {
        var client = await factory.CreateClientAsync();

        var unknown = await client.PostAsJsonAsync("api/auth/login", new { identifiant = "personne", password = "Mauvais123!" });
        var wrong = await client.PostAsJsonAsync("api/auth/login", new { identifiant = "client", password = "Mauvais123!" });

        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        Assert.Equal(await Detail(unknown), await Detail(wrong));
    }

    [Fact]
    public async Task Login_is_refused_for_deactivated_account()
    {
        var client = await factory.CreateClientAsync();

        var response = await client.PostAsJsonAsync("api/auth/login", new { identifiant = "inactif", password = ApiFactory.Password });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Register_creates_client_without_token_and_validates_input()
    {
        var client = await factory.CreateClientAsync();

        var invalid = await client.PostAsJsonAsync("api/auth/register", new { nom = "X", email = "pas-un-email", password = "court" });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        Assert.Equal("application/problem+json", invalid.Content.Headers.ContentType?.MediaType);

        var created = await client.PostAsJsonAsync("api/auth/register",
            new { nom = "Nouveau", email = "nouveau@resto.local", password = ApiFactory.Password, langueFavorite = "ar" });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        using var json = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        Assert.Equal("Client", json.RootElement.GetProperty("roles")[0].GetString());
        Assert.Equal("ar", json.RootElement.GetProperty("langueFavorite").GetString());

        var duplicate = await client.PostAsJsonAsync("api/auth/register",
            new { nom = "Nouveau", email = "nouveau@resto.local", password = ApiFactory.Password });
        Assert.Equal(HttpStatusCode.Conflict, duplicate.StatusCode);
    }

    private static async Task<string?> Detail(HttpResponseMessage response)
    {
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return json.RootElement.GetProperty("detail").GetString();
    }
}
