using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Resto.Tests;

public class AuthorizationTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    [Theory]
    [InlineData("api/admin/users")]
    [InlineData("api/auth/me")]
    public async Task Protected_routes_return_401_without_token(string url)
    {
        var client = await factory.CreateClientAsync();

        var response = await client.GetAsync(url);

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Admin_route_returns_403_for_client_role()
    {
        var client = await factory.CreateClientAsync("client");

        var response = await client.GetAsync("api/admin/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Admin_route_returns_200_for_admin_role()
    {
        var client = await factory.CreateClientAsync("admin");

        var response = await client.GetAsync("api/admin/users?pageSize=500");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(50, json.RootElement.GetProperty("pageSize").GetInt32());
    }

    [Fact]
    public async Task Token_of_deactivated_user_is_rejected()
    {
        var client = await factory.CreateClientAsync("inactif");

        var response = await client.GetAsync("api/auth/me");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Health_is_anonymous()
    {
        var client = await factory.CreateClientAsync();

        var response = await client.GetAsync("health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Admin_cannot_deactivate_self()
    {
        var client = await factory.CreateClientAsync("admin");
        var id = await factory.GetUserIdAsync("admin");

        var response = await client.PatchAsJsonAsync($"api/admin/users/{id}/actif", new { estActif = false });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Me_returns_profile_with_roles_for_valid_token()
    {
        var client = await factory.CreateClientAsync("client");

        var response = await client.GetAsync("api/auth/me");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("client", json.RootElement.GetProperty("userName").GetString());
        Assert.Equal("Client", json.RootElement.GetProperty("roles")[0].GetString());
    }
}
