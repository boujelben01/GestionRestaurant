using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Resto.Tests;

// EF InMemory : ne reproduit pas les contraintes PostgreSQL (CHECK Id = 1, index uniques).
public class RestaurantApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static object[] Week(Func<int, object> day) => Enumerable.Range(0, 7).Select(day).ToArray();

    [Fact]
    public async Task Restaurant_info_is_public_with_seven_days_and_open_flag()
    {
        var client = await factory.CreateClientAsync();

        var response = await client.GetAsync("api/restaurant");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await Json(response);
        Assert.Equal(7, body.GetProperty("horaires").GetArrayLength());
        Assert.NotNull(body.GetProperty("horaires")[1].GetProperty("ouverture").GetString());
        Assert.True(body.TryGetProperty("ouvertMaintenant", out _));
    }

    [Fact]
    public async Task Admin_restaurant_routes_require_admin_role()
    {
        var payload = new { commandesOuvertes = true };

        Assert.Equal(HttpStatusCode.Unauthorized,
            (await (await factory.CreateClientAsync()).PatchAsJsonAsync("api/admin/restaurant/commandes-ouvertes", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await (await factory.CreateClientAsync("client")).PatchAsJsonAsync("api/admin/restaurant/commandes-ouvertes", payload)).StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await (await factory.CreateClientAsync("admin")).PatchAsJsonAsync("api/admin/restaurant/commandes-ouvertes", payload)).StatusCode);
    }

    [Fact]
    public async Task Admin_can_update_settings_and_validation_rejects_negative_fees()
    {
        var client = await factory.CreateClientAsync("admin");

        var invalid = await client.PutAsJsonAsync("api/admin/restaurant", new
        {
            nom = "Resto", telephone = "+216 70 000 000", email = "contact@resto.local", adresse = "Tunis",
            fraisLivraison = -1m, montantMinimumLivraison = 10m
        });
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);

        var badPhone = await client.PutAsJsonAsync("api/admin/restaurant", new
        {
            nom = "Resto", telephone = "pas un numéro", email = "contact@resto.local", adresse = "Tunis",
            fraisLivraison = 3m, montantMinimumLivraison = 10m
        });
        Assert.Equal(HttpStatusCode.BadRequest, badPhone.StatusCode);

        var ok = await client.PutAsJsonAsync("api/admin/restaurant", new
        {
            nom = "Resto Tunis", telephone = "+216 71 111 111", email = "contact@resto.local", adresse = "Tunis",
            fraisLivraison = 4m, montantMinimumLivraison = 20m
        });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        Assert.Equal("Resto Tunis", (await Json(ok)).GetProperty("nom").GetString());
    }

    [Fact]
    public async Task Hours_replacement_validates_and_applies()
    {
        var client = await factory.CreateClientAsync("admin");

        var sixDays = await client.PutAsJsonAsync("api/admin/restaurant/horaires", new
        {
            horaires = Enumerable.Range(0, 6).Select(d => new { jourSemaine = d, ouverture = "10:00", fermeture = "22:00", estFerme = false })
        });
        Assert.Equal(HttpStatusCode.BadRequest, sixDays.StatusCode);

        var missingClosing = await client.PutAsJsonAsync("api/admin/restaurant/horaires", new
        {
            horaires = Week(d => new { jourSemaine = d, ouverture = "10:00", fermeture = (string?)null, estFerme = false })
        });
        Assert.Equal(HttpStatusCode.BadRequest, missingClosing.StatusCode);

        var badFormat = await client.PutAsJsonAsync("api/admin/restaurant/horaires", new
        {
            horaires = Week(d => new { jourSemaine = d, ouverture = "25:00", fermeture = "22:00", estFerme = false })
        });
        Assert.Equal(HttpStatusCode.BadRequest, badFormat.StatusCode);

        var duplicateDay = await client.PutAsJsonAsync("api/admin/restaurant/horaires", new
        {
            horaires = Week(d => new { jourSemaine = 0, ouverture = "10:00", fermeture = "22:00", estFerme = false })
        });
        Assert.Equal(HttpStatusCode.BadRequest, duplicateDay.StatusCode);

        var ok = await client.PutAsJsonAsync("api/admin/restaurant/horaires", new
        {
            horaires = Week(d => d == 0
                ? new { jourSemaine = d, ouverture = (string?)null, fermeture = (string?)null, estFerme = true }
                : new { jourSemaine = d, ouverture = (string?)"12:00", fermeture = (string?)"02:00", estFerme = false })
        });
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var horaires = (await Json(ok)).GetProperty("horaires");
        Assert.True(horaires[0].GetProperty("estFerme").GetBoolean());
        Assert.Equal("02:00", horaires[1].GetProperty("fermeture").GetString());
    }
}
