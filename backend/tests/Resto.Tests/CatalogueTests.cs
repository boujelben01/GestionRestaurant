using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Resto.Api.Data;
using Resto.Api.Data.Catalogue;

namespace Resto.Tests;

// EF InMemory : vérifie la lecture, la validation, le plan et l'upsert, pas leur exécution sur PostgreSQL.
public class CatalogueTests
{
    private const string Valid = """
        { "categories": [ { "nomFr": "Boissons", "nomAr": "المشروبات", "ordre": 1, "articles": [
          { "ordre": 1, "nomFr": "Citronnade", "nomAr": "ليمونادة", "descriptionFr": "Frais.", "descriptionAr": "منعش",
            "prix": 4, "populaire": false, "disponible": true, "image": "/images/menu/citronnade.webp" },
          { "ordre": 2, "nomFr": "Eau", "nomAr": "ماء", "descriptionFr": null, "descriptionAr": null,
            "prix": 1.5, "populaire": true, "disponible": true, "image": null }
        ] } ] }
        """;

    private static AppDbContext NewDb() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseInMemoryDatabase(Guid.NewGuid().ToString())
        .ConfigureWarnings(w => w.Ignore(InMemoryEventId.TransactionIgnoredWarning))
        .Options);

    private static CatalogueFile Parse(string json = Valid) => CatalogueReader.Parse(json);

    private static async Task<int> RunAsync(AppDbContext db, string json, StringWriter output, params string[] args)
    {
        var path = Path.Combine(Path.GetTempPath(), $"catalogue-{Guid.NewGuid():N}.json");
        await File.WriteAllTextAsync(path, json);
        try
        {
            return await CatalogueCommand.RunAsync(["--seed-catalog", .. args], db, path, output);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void The_shipped_catalogue_file_is_readable_and_valid()
    {
        var file = CatalogueReader.Read(CatalogueReader.DefaultPath);

        Assert.Empty(CatalogueValidator.Validate(file));
        Assert.NotEmpty(file.Categories!);
    }

    [Fact]
    public void Read_parses_the_structure()
    {
        var file = Parse();

        var categorie = Assert.Single(file.Categories!);
        Assert.Equal("Boissons", categorie.NomFr);
        Assert.Equal(2, categorie.Articles!.Count);
        Assert.Equal(1.5m, categorie.Articles[1].Prix);
        Assert.Null(categorie.Articles[1].Image);
    }

    [Fact]
    public void Read_reports_malformed_json_and_missing_file()
    {
        Assert.Throws<CatalogueException>(() => CatalogueReader.Parse("{ pas du json"));
        Assert.Throws<CatalogueException>(() => CatalogueReader.Read(Path.Combine(Path.GetTempPath(), "inexistant-catalogue.json")));
    }

    [Theory]
    [InlineData("\"prix\": 4,", "\"prix\": -1,", "prix")]
    [InlineData("\"prix\": 4,", "\"prix\": 4.123,", "décimales")]
    [InlineData("\"prix\": 4,", "", "prix absent")]
    [InlineData("\"nomAr\": \"ليمونادة\"", "\"nomAr\": \"  \"", "nomAr")]
    [InlineData("\"nomFr\": \"Citronnade\"", "\"nomFr\": \"Eau\"", "en double")]
    [InlineData("/images/menu/citronnade.webp", "/images/../secret.png", "image")]
    [InlineData("/images/menu/citronnade.webp", "http://exemple.com/a.png", "image")]
    [InlineData("\"disponible\": true, \"image\": \"/images", "\"image\": \"/images", "disponible")]
    public void Validate_rejects_invalid_articles(string find, string replace, string expected)
    {
        var errors = CatalogueValidator.Validate(Parse(Valid.Replace(find, replace)));

        Assert.Contains(errors, e => e.Contains(expected, StringComparison.Ordinal));
    }

    [Fact]
    public void Validate_rejects_empty_catalogue_and_duplicate_categories()
    {
        Assert.NotEmpty(CatalogueValidator.Validate(Parse("""{ "categories": [] }""")));
        Assert.NotEmpty(CatalogueValidator.Validate(Parse("{}")));

        var twice = Parse("""
            { "categories": [
              { "nomFr": "A", "nomAr": "أ", "ordre": 1, "articles": [] },
              { "nomFr": "a", "nomAr": "ب", "ordre": 2, "articles": [] } ] }
            """);
        Assert.Contains(CatalogueValidator.Validate(twice), e => e.Contains("en double"));
    }

    private const string WithEmptyCategory = """
        { "categories": [
          { "nomFr": "Pizza", "nomAr": "بيتزا", "ordre": 1, "articles": [] },
          { "nomFr": "Boissons", "nomAr": "المشروبات", "ordre": 2, "articles": [
            { "ordre": 1, "nomFr": "Eau", "nomAr": "ماء", "prix": 1.5, "populaire": false, "disponible": true, "image": null } ] } ] }
        """;

    [Fact]
    public void Validate_accepts_a_category_without_articles_but_not_a_missing_list()
    {
        Assert.Empty(CatalogueValidator.Validate(Parse(WithEmptyCategory)));

        var missingList = Parse("""{ "categories": [ { "nomFr": "A", "nomAr": "أ", "ordre": 1 } ] }""");
        Assert.Contains(CatalogueValidator.Validate(missingList), e => e.Contains("articles"));
    }

    [Fact]
    public async Task Empty_category_is_planned_created_updated_and_idempotent_without_articles()
    {
        await using var db = NewDb();

        var simulation = await CatalogueSync.PlanAsync(db, Parse(WithEmptyCategory), deactivateMissing: false);
        Assert.Contains(simulation.Changes, c => c is { Entity: "Catégorie", Type: ChangeType.Create, Name: "Pizza" });
        Assert.Equal(0, await db.Categories.CountAsync());

        await CatalogueSync.ApplyAsync(db, Parse(WithEmptyCategory), false);
        var pizza = await db.Categories.Include(c => c.Articles).SingleAsync(c => c.NomFr == "Pizza");
        Assert.Empty(pizza.Articles);

        var renamed = Parse(WithEmptyCategory.Replace("بيتزا", "بيتزا جديدة").Replace("\"ordre\": 1, \"articles\": []", "\"ordre\": 7, \"articles\": []"));
        var update = await CatalogueSync.ApplyAsync(db, renamed, false);
        Assert.Contains(update.Changes, c => c is { Entity: "Catégorie", Type: ChangeType.Update, Name: "Pizza" });
        db.ChangeTracker.Clear();
        Assert.Equal(7, (await db.Categories.SingleAsync(c => c.NomFr == "Pizza")).Ordre);

        var again = await CatalogueSync.ApplyAsync(db, renamed, false);
        Assert.Equal(0, again.Count(ChangeType.Create) + again.Count(ChangeType.Update));
        Assert.Equal(2, await db.Categories.CountAsync());
    }

    [Fact]
    public async Task Plan_on_an_empty_database_creates_everything_and_writes_nothing()
    {
        await using var db = NewDb();

        var plan = await CatalogueSync.PlanAsync(db, Parse(), deactivateMissing: false);

        Assert.Equal(1 + 2, plan.Count(ChangeType.Create));
        Assert.Equal(0, plan.Count(ChangeType.Update) + plan.Count(ChangeType.Unchanged) + plan.Count(ChangeType.Missing));
        Assert.Equal(0, await db.Categories.CountAsync());
        Assert.Equal(0, await db.Articles.CountAsync());
    }

    [Fact]
    public async Task Simulation_command_reports_but_does_not_write()
    {
        await using var db = NewDb();
        var output = new StringWriter();

        var code = await RunAsync(db, Valid, output);

        Assert.Equal(0, code);
        Assert.Contains("SIMULATION", output.ToString());
        Assert.Contains("[à créer] Catégorie Boissons", output.ToString());
        Assert.Equal(0, await db.Categories.CountAsync());
    }

    [Fact]
    public async Task Apply_is_idempotent()
    {
        await using var db = NewDb();

        await CatalogueSync.ApplyAsync(db, Parse(), deactivateMissing: false);
        var second = await CatalogueSync.ApplyAsync(db, Parse(), deactivateMissing: false);

        Assert.Equal(1, await db.Categories.CountAsync());
        Assert.Equal(2, await db.Articles.CountAsync());
        Assert.Equal(0, second.Count(ChangeType.Create) + second.Count(ChangeType.Update));
        Assert.Equal(3, second.Count(ChangeType.Unchanged));
    }

    [Fact]
    public async Task Apply_updates_changed_fields_and_reactivates_without_duplicating()
    {
        await using var db = NewDb();
        await CatalogueSync.ApplyAsync(db, Parse(), false);
        var citronnade = await db.Articles.SingleAsync(a => a.NomFr == "Citronnade");
        citronnade.Prix = 9m;
        citronnade.EstActif = false;
        await db.SaveChangesAsync();

        var plan = await CatalogueSync.ApplyAsync(db, Parse(), false);

        var update = Assert.Single(plan.Changes, c => c.Type == ChangeType.Update);
        Assert.Contains("prix", update.Detail);
        Assert.Contains("réactivé", update.Detail);
        db.ChangeTracker.Clear();
        var fresh = await db.Articles.AsNoTracking().SingleAsync(a => a.NomFr == "Citronnade");
        Assert.Equal(4m, fresh.Prix);
        Assert.True(fresh.EstActif);
        Assert.Equal(2, await db.Articles.CountAsync());
    }

    [Fact]
    public async Task Missing_items_are_reported_then_deactivated_only_on_request_and_never_deleted()
    {
        await using var db = NewDb();
        await CatalogueSync.ApplyAsync(db, Parse(), false);
        var ancienne = new Api.Domain.Categorie { NomFr = "Ancienne", NomAr = "قديمة", Ordre = 5 };
        ancienne.Articles.Add(new Api.Domain.Article { NomFr = "Vieux plat", NomAr = "قديم", Prix = 3m });
        db.Categories.Add(ancienne);
        await db.SaveChangesAsync();
        var withoutCitronnade = Parse(Valid[..Valid.IndexOf("{ \"ordre\": 1", StringComparison.Ordinal)]
            + Valid[Valid.IndexOf("{ \"ordre\": 2", StringComparison.Ordinal)..]);
        Assert.Single(withoutCitronnade.Categories![0].Articles!);

        var simulation = await CatalogueSync.PlanAsync(db, withoutCitronnade, deactivateMissing: false);
        Assert.Equal(3, simulation.Count(ChangeType.Missing));
        Assert.Equal(0, simulation.Count(ChangeType.Deactivate));

        var applied = await CatalogueSync.ApplyAsync(db, withoutCitronnade, deactivateMissing: true);

        Assert.Equal(3, applied.Count(ChangeType.Deactivate));
        db.ChangeTracker.Clear();
        Assert.Equal(2, await db.Categories.CountAsync());
        Assert.Equal(3, await db.Articles.CountAsync());
        Assert.False((await db.Categories.SingleAsync(c => c.NomFr == "Ancienne")).EstActive);
        Assert.False((await db.Articles.SingleAsync(a => a.NomFr == "Vieux plat")).EstActif);
        Assert.False((await db.Articles.SingleAsync(a => a.NomFr == "Citronnade")).EstActif);
        Assert.True((await db.Articles.SingleAsync(a => a.NomFr == "Eau")).EstActif);
        Assert.True((await db.Categories.SingleAsync(c => c.NomFr == "Boissons")).EstActive);
    }

    [Fact]
    public async Task Invalid_file_writes_nothing_and_lists_the_errors()
    {
        await using var db = NewDb();
        var output = new StringWriter();

        var code = await RunAsync(db, Valid.Replace("\"prix\": 4,", "\"prix\": -1,"), output, "--apply");

        Assert.Equal(1, code);
        Assert.Contains("rien n'a été écrit", output.ToString());
        Assert.Equal(0, await db.Categories.CountAsync());
    }

    [Fact]
    public async Task Deactivate_missing_without_apply_is_refused()
    {
        await using var db = NewDb();
        var output = new StringWriter();

        var code = await RunAsync(db, Valid, output, "--deactivate-missing");

        Assert.Equal(2, code);
        Assert.Equal(0, await db.Categories.CountAsync());
    }
}
