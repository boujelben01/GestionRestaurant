using System.Net;
using System.Net.Http.Json;
using System.Text.Json;

namespace Resto.Tests;

// EF InMemory : pas de contrainte SQL ; la limite de 10 et l'unicité de l'adresse par défaut sont garanties par le
// code applicatif (séquentiellement) et non par la base : deux requêtes simultanées ne sont pas exercées ici.
public class AdressesApiTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static async Task<JsonElement> Json(HttpResponseMessage response)
    {
        using var doc = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return doc.RootElement.Clone();
    }

    private static object Body(string libelle = "Maison", bool defaut = false, string? details = null, string telephone = "+21620123456") =>
        new { libelle, ligne = "12 rue de la Liberté", ville = "Tunis", details, telephone, estParDefaut = defaut };

    private static async Task<int> CreateAsync(HttpClient client, string libelle = "Maison", bool defaut = false)
    {
        var response = await client.PostAsJsonAsync("api/adresses", Body(libelle, defaut));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return (await Json(response)).GetProperty("id").GetInt32();
    }

    private static async Task<JsonElement[]> ListAsync(HttpClient client) =>
        (await Json(await client.GetAsync("api/adresses"))).EnumerateArray().ToArray();

    private static string[] Defaults(JsonElement[] addresses) =>
        addresses.Where(a => a.GetProperty("estParDefaut").GetBoolean()).Select(a => a.GetProperty("libelle").GetString()!).ToArray();

    // ---------- Accès ----------

    [Theory]
    [InlineData("GET", "api/adresses")]
    [InlineData("POST", "api/adresses")]
    [InlineData("PUT", "api/adresses/1")]
    [InlineData("DELETE", "api/adresses/1")]
    [InlineData("PATCH", "api/adresses/1/defaut")]
    public async Task Addresses_require_authentication(string method, string url)
    {
        var client = await factory.CreateClientAsync();
        var request = new HttpRequestMessage(new HttpMethod(method), url) { Content = method is "POST" or "PUT" ? JsonContent.Create(Body()) : null };

        Assert.Equal(HttpStatusCode.Unauthorized, (await client.SendAsync(request)).StatusCode);
    }

    // ---------- Création et défaut ----------

    [Fact]
    public async Task The_first_address_is_automatically_the_default_even_if_not_requested()
    {
        var client = await factory.CreateClientForNewUserAsync();

        var response = await client.PostAsJsonAsync("api/adresses", Body("Maison", defaut: false));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var created = await Json(response);
        Assert.True(created.GetProperty("estParDefaut").GetBoolean());
        Assert.Equal("Maison", created.GetProperty("libelle").GetString());
        Assert.Equal("+21620123456", created.GetProperty("telephone").GetString());
    }

    [Fact]
    public async Task A_second_address_is_not_the_default_unless_requested()
    {
        var client = await factory.CreateClientForNewUserAsync();
        await CreateAsync(client, "Maison");
        await CreateAsync(client, "Bureau");

        Assert.Equal(["Maison"], Defaults(await ListAsync(client)));
    }

    [Fact]
    public async Task Creating_a_default_address_removes_the_flag_from_the_others_so_there_is_only_one()
    {
        var client = await factory.CreateClientForNewUserAsync();
        await CreateAsync(client, "Maison");
        await CreateAsync(client, "Bureau", defaut: true);
        await CreateAsync(client, "Parents", defaut: true);

        Assert.Equal(["Parents"], Defaults(await ListAsync(client)));
    }

    [Fact]
    public async Task The_list_puts_the_default_first_then_the_others_by_age()
    {
        var client = await factory.CreateClientForNewUserAsync();
        await CreateAsync(client, "A");
        await CreateAsync(client, "B");
        await CreateAsync(client, "C", defaut: true);

        var order = (await ListAsync(client)).Select(a => a.GetProperty("libelle").GetString()).ToArray();

        Assert.Equal(["C", "A", "B"], order);
    }

    [Fact]
    public async Task The_eleventh_address_is_refused_with_409()
    {
        var client = await factory.CreateClientForNewUserAsync();
        for (var i = 1; i <= 10; i++)
        {
            await CreateAsync(client, $"Adresse {i}");
        }

        var response = await client.PostAsJsonAsync("api/adresses", Body("Une de trop"));

        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        Assert.Contains("10", (await Json(response)).GetProperty("title").GetString());
        Assert.Equal(10, (await ListAsync(client)).Length);
    }

    [Fact]
    public async Task Deleting_one_frees_a_slot_under_the_limit()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var ids = new List<int>();
        for (var i = 1; i <= 10; i++)
        {
            ids.Add(await CreateAsync(client, $"Adresse {i}"));
        }

        await client.DeleteAsync($"api/adresses/{ids[5]}");

        Assert.Equal(HttpStatusCode.Created, (await client.PostAsJsonAsync("api/adresses", Body("Nouvelle"))).StatusCode);
    }

    // ---------- Validation ----------

    public static TheoryData<string> InvalidBodies => new()
    {
        "{}",
        "{\"libelle\":\"\",\"ligne\":\"x\",\"ville\":\"y\",\"telephone\":\"+21620123456\"}",
        "{\"libelle\":\"   \",\"ligne\":\"x\",\"ville\":\"y\",\"telephone\":\"+21620123456\"}",
        "{\"libelle\":\"Maison\",\"ligne\":\"\",\"ville\":\"y\",\"telephone\":\"+21620123456\"}",
        "{\"libelle\":\"Maison\",\"ligne\":\"x\",\"ville\":\"\",\"telephone\":\"+21620123456\"}",
        "{\"libelle\":\"Maison\",\"ligne\":\"x\",\"ville\":\"y\"}",
        "{\"libelle\":\"Maison\",\"ligne\":\"x\",\"ville\":\"y\",\"telephone\":\"pas un téléphone\"}",
        "{\"libelle\":\"Maison\",\"ligne\":\"x\",\"ville\":\"y\",\"telephone\":\"+216201234561234567890\"}",
        "{\"libelle\":\"Maison\",\"ligne\":\"x\",\"ville\":\"y\",\"telephone\":\"+21620123456\",\"estParDefaut\":\"oui\"}",
    };

    [Theory]
    [MemberData(nameof(InvalidBodies))]
    public async Task Invalid_bodies_return_400_and_create_nothing(string body)
    {
        var client = await factory.CreateClientForNewUserAsync();

        var response = await client.PostAsync("api/adresses", new StringContent(body, System.Text.Encoding.UTF8, "application/json"));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Empty(await ListAsync(client));
    }

    [Theory]
    [InlineData("libelle", 51)]
    [InlineData("ligne", 201)]
    [InlineData("ville", 101)]
    [InlineData("details", 301)]
    public async Task Fields_longer_than_the_database_limits_are_refused(string field, int length)
    {
        var client = await factory.CreateClientForNewUserAsync();
        var body = new Dictionary<string, object?>
        {
            ["libelle"] = "Maison", ["ligne"] = "12 rue", ["ville"] = "Tunis", ["telephone"] = "+21620123456", ["details"] = null,
        };
        body[field] = new string('x', length);

        Assert.Equal(HttpStatusCode.BadRequest, (await client.PostAsJsonAsync("api/adresses", body)).StatusCode);
    }

    [Fact]
    public async Task Fields_at_the_exact_limits_and_blank_details_are_accepted()
    {
        var client = await factory.CreateClientForNewUserAsync();

        var response = await client.PostAsJsonAsync("api/adresses", new
        {
            libelle = new string('a', 50), ligne = new string('b', 200), ville = new string('c', 100), details = "   ", telephone = "+21620123456",
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await Json(response)).GetProperty("details").ValueKind); // espaces seuls = pas de détails
    }

    [Fact]
    public async Task Values_are_trimmed()
    {
        var client = await factory.CreateClientForNewUserAsync();

        var created = await Json(await client.PostAsJsonAsync("api/adresses", new
        {
            libelle = "  Maison  ", ligne = "  12 rue  ", ville = " Tunis ", telephone = " +21620123456 ", details = " 2e étage ",
        }));

        Assert.Equal("Maison", created.GetProperty("libelle").GetString());
        Assert.Equal("12 rue", created.GetProperty("ligne").GetString());
        Assert.Equal("2e étage", created.GetProperty("details").GetString());
    }

    // ---------- Modification ----------

    [Fact]
    public async Task An_address_can_be_updated()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var id = await CreateAsync(client);

        var response = await client.PutAsJsonAsync($"api/adresses/{id}", new
        {
            libelle = "Bureau", ligne = "5 avenue Habib Bourguiba", ville = "Sfax", details = "3e étage", telephone = "+21698765432", estParDefaut = true,
        });

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var updated = await Json(response);
        Assert.Equal("Bureau", updated.GetProperty("libelle").GetString());
        Assert.Equal("Sfax", updated.GetProperty("ville").GetString());
        Assert.Equal("+21698765432", updated.GetProperty("telephone").GetString());
    }

    [Fact]
    public async Task Updating_with_default_true_moves_the_default_and_false_cannot_leave_no_default()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var home = await CreateAsync(client, "Maison");
        var office = await CreateAsync(client, "Bureau");

        await client.PutAsJsonAsync($"api/adresses/{office}", Body("Bureau", defaut: true));
        Assert.Equal(["Bureau"], Defaults(await ListAsync(client)));

        // « estParDefaut = false » sur la défaut actuelle : elle le reste (il doit toujours y avoir une défaut).
        await client.PutAsJsonAsync($"api/adresses/{office}", Body("Bureau", defaut: false));
        Assert.Equal(["Bureau"], Defaults(await ListAsync(client)));
        Assert.Equal(home, (await ListAsync(client)).Single(a => a.GetProperty("libelle").GetString() == "Maison").GetProperty("id").GetInt32());
    }

    [Fact]
    public async Task Updating_with_invalid_data_returns_400_and_changes_nothing()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var id = await CreateAsync(client);

        var response = await client.PutAsJsonAsync($"api/adresses/{id}", Body(libelle: "", defaut: false));

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("Maison", (await ListAsync(client)).Single().GetProperty("libelle").GetString());
    }

    // ---------- PATCH défaut ----------

    [Fact]
    public async Task Setting_the_default_is_exclusive_and_idempotent()
    {
        var client = await factory.CreateClientForNewUserAsync();
        await CreateAsync(client, "Maison");
        var office = await CreateAsync(client, "Bureau");

        var first = await client.PatchAsync($"api/adresses/{office}/defaut", null);
        var again = await client.PatchAsync($"api/adresses/{office}/defaut", null);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, again.StatusCode);
        Assert.True((await Json(again)).GetProperty("estParDefaut").GetBoolean());
        Assert.Equal(["Bureau"], Defaults(await ListAsync(client)));
    }

    // ---------- Suppression ----------

    [Fact]
    public async Task Deleting_an_address_really_removes_it()
    {
        var client = await factory.CreateClientForNewUserAsync();
        await CreateAsync(client, "Maison");
        var office = await CreateAsync(client, "Bureau");

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"api/adresses/{office}")).StatusCode);

        Assert.Equal(["Maison"], (await ListAsync(client)).Select(a => a.GetProperty("libelle").GetString()!).ToArray());
        Assert.Equal(HttpStatusCode.NotFound, (await client.DeleteAsync($"api/adresses/{office}")).StatusCode);
    }

    [Fact]
    public async Task Deleting_the_default_promotes_the_oldest_remaining_address()
    {
        var client = await factory.CreateClientForNewUserAsync();
        await CreateAsync(client, "Ancienne");
        await CreateAsync(client, "Récente");
        var current = await CreateAsync(client, "Défaut actuelle", defaut: true);

        await client.DeleteAsync($"api/adresses/{current}");

        Assert.Equal(["Ancienne"], Defaults(await ListAsync(client)));
    }

    [Fact]
    public async Task Deleting_the_only_address_leaves_an_empty_book_and_the_next_one_becomes_the_default()
    {
        var client = await factory.CreateClientForNewUserAsync();
        var only = await CreateAsync(client, "Seule");

        await client.DeleteAsync($"api/adresses/{only}");
        Assert.Empty(await ListAsync(client));

        await CreateAsync(client, "Nouvelle");
        Assert.Equal(["Nouvelle"], Defaults(await ListAsync(client)));
    }

    // ---------- Isolation ----------

    [Fact]
    public async Task Another_users_address_is_not_found_never_forbidden()
    {
        var alice = await factory.CreateClientForNewUserAsync();
        var bob = await factory.CreateClientForNewUserAsync();
        var id = await CreateAsync(alice, "Privée");

        Assert.Equal(HttpStatusCode.NotFound, (await bob.PutAsJsonAsync($"api/adresses/{id}", Body("Pirate"))).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.DeleteAsync($"api/adresses/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await bob.PatchAsync($"api/adresses/{id}/defaut", null)).StatusCode);
        Assert.Empty(await ListAsync(bob));
        Assert.Equal("Privée", (await ListAsync(alice)).Single().GetProperty("libelle").GetString());
    }

    [Fact]
    public async Task The_limit_and_the_default_are_per_user()
    {
        var alice = await factory.CreateClientForNewUserAsync();
        var bob = await factory.CreateClientForNewUserAsync();
        for (var i = 1; i <= 10; i++)
        {
            await CreateAsync(alice, $"A{i}");
        }

        var response = await bob.PostAsJsonAsync("api/adresses", Body("B1"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        Assert.True((await Json(response)).GetProperty("estParDefaut").GetBoolean()); // sa première, donc sa défaut
        Assert.Equal(["A1"], Defaults(await ListAsync(alice)));
    }

    [Fact]
    public async Task An_unknown_address_returns_404()
    {
        var client = await factory.CreateClientForNewUserAsync();

        Assert.Equal(HttpStatusCode.NotFound, (await client.PutAsJsonAsync("api/adresses/999999", Body())).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.PatchAsync("api/adresses/999999/defaut", null)).StatusCode);
    }
}
