using Microsoft.EntityFrameworkCore;
using Resto.Api.Data;
using Resto.Api.Domain;
using Resto.Api.Features.Commandes.Admin;
using Resto.Api.Features.Adresses;
using Resto.Api.Features.Favoris;
using Resto.Api.Features.Menu.Admin;
using Resto.Api.Features.Statistiques;
using Resto.Api.Features.Tables;

namespace Resto.Tests;

// GARDE-FOU CONTRE LES 500 « INTRADUISIBLES EN SQL ».
//
// Les tests d'intégration utilisent EF InMemory, qui évalue les requêtes LINQ en mémoire : il accepte des
// expressions que le fournisseur Npgsql (PostgreSQL) ne sait PAS traduire en SQL. Une telle requête passe
// tous les tests puis lève une InvalidOperationException (500) en production. Exemple réel : un
// `Select(c => new Dto(..., c.Articles.Count(...))).OrderBy(c => c.Ordre)` sur la liste des catégories.
//
// Ici, on construit les requêtes EXACTES des services admin avec le fournisseur Npgsql et une chaîne de
// connexion factice. `ToQueryString()` compile la requête en SQL sans ouvrir de connexion : si la
// traduction est impossible, elle lève. Ce test ne prouve PAS que le SQL produit est correct ni que la
// base répond (aucune exécution sur PostgreSQL), seulement que la requête est traduisible.
public class SqlTranslationTests
{
    private static AppDbContext NpgsqlContext() => new(new DbContextOptionsBuilder<AppDbContext>()
        .UseNpgsql("Host=127.0.0.1;Port=1;Database=fake;Username=fake;Password=fake")
        .Options);

    private static string Sql<T>(IQueryable<T> query) => query.ToQueryString();

    // Npgsql écrit certains mots-clés en minuscules (count(*), sum(...)) : comparaison insensible à la casse.
    private static void HasSql(string sql, string fragment) =>
        Assert.Contains(fragment, sql, StringComparison.OrdinalIgnoreCase);

    // ---------- Catégories (la régression d'origine) ----------

    [Fact]
    public void Categories_list_translates_with_the_article_count_and_the_order()
    {
        using var db = NpgsqlContext();

        var sql = Sql(CategorieAdminService.ListQuery(db));

        HasSql(sql, "COUNT(");
        HasSql(sql, "ORDER BY");
    }

    [Fact]
    public void A_category_by_id_translates()
    {
        using var db = NpgsqlContext();

        var sql = Sql(CategorieAdminService.GetQuery(db, 1));

        HasSql(sql, "COUNT(");
        HasSql(sql, "WHERE");
    }

    [Fact]
    public void The_old_shape_filtering_or_ordering_after_the_projection_is_detected_as_untranslatable()
    {
        // Contrôle négatif : prouve que ce garde-fou attrape bien la forme qui causait le 500.
        using var db = NpgsqlContext();
        IQueryable<CategorieAdminResponse> Projected() => db.Categories.AsNoTracking().Select(c => new CategorieAdminResponse(
            c.Id, c.NomFr, c.NomAr, c.Ordre, c.EstActive, c.Articles.Count(a => a.EstActif)));

        Assert.Throws<InvalidOperationException>(() => Projected().OrderBy(c => c.Ordre).ThenBy(c => c.Id).ToQueryString());
        Assert.Throws<InvalidOperationException>(() => Projected().Where(c => c.Id == 1).ToQueryString());
    }

    // ---------- Articles ----------

    [Fact]
    public void The_article_list_translates_with_every_filter()
    {
        using var db = NpgsqlContext();

        var all = ArticleAdminService.PageQuery(ArticleAdminService.FilteredQuery(db, 3, true, false, "Brik"), 2, 20);
        var none = ArticleAdminService.PageQuery(ArticleAdminService.FilteredQuery(db, null, null, null, null), 1, 50);

        var sql = Sql(all);
        HasSql(sql, "LIMIT");
        HasSql(sql, "ORDER BY");
        HasSql(sql, "LIKE");
        HasSql(Sql(none), "ORDER BY");
    }

    // ---------- Commandes (Bloc 5) ----------

    [Fact]
    public void The_order_list_translates_with_every_filter_combined()
    {
        using var db = NpgsqlContext();
        var from = new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc);
        var filters = new CommandeAdminService.ListFilters(
            [StatutCommande.EnAttente, StatutCommande.Prete], TypeCommande.Livraison, false,
            new CommandeAdminService.Bound(from, true), new CommandeAdminService.Bound(from.AddDays(10), false), "dupont");

        var filtered = CommandeAdminService.ApplyFilters(db.Commandes.AsNoTracking(), filters);

        HasSql(Sql(filtered), "WHERE");
        var page = Sql(CommandeAdminService.SummaryQuery(filtered, 2, 20));
        HasSql(page, "ORDER BY");
        HasSql(page, "SUM("); // nombre d'articles
    }

    [Fact]
    public void An_unfiltered_order_list_and_a_date_only_end_bound_translate()
    {
        using var db = NpgsqlContext();
        var noFilter = new CommandeAdminService.ListFilters([], null, null, null, null, null);
        var dayEnd = new CommandeAdminService.ListFilters(
            [], null, null, null, new CommandeAdminService.Bound(new DateTime(2024, 6, 30, 0, 0, 0, DateTimeKind.Utc), true), null);

        Assert.NotEmpty(Sql(CommandeAdminService.SummaryQuery(CommandeAdminService.ApplyFilters(db.Commandes, noFilter), 1, 20)));
        Assert.NotEmpty(Sql(CommandeAdminService.ApplyFilters(db.Commandes, dayEnd)));
    }

    [Fact]
    public void The_order_detail_queries_translate()
    {
        using var db = NpgsqlContext();

        HasSql(Sql(CommandeAdminService.DetailQuery(db, 1)), "WHERE");
        HasSql(Sql(CommandeAdminService.LignesQuery(db, 1)), "ORDER BY");
        // L'auteur de chaque changement : jointure sur l'utilisateur, mais seules deux colonnes sont lues.
        var history = Sql(CommandeAdminService.HistoriqueQuery(db, 1));
        Assert.DoesNotContain("PasswordHash", history);
        Assert.DoesNotContain("SecurityStamp", history);
    }

    [Fact]
    public void The_kitchen_screen_query_translates_with_its_order_lines()
    {
        using var db = NpgsqlContext();

        var sql = Sql(CommandeAdminService.ActivesQuery(db));

        HasSql(sql, "LIMIT");
        HasSql(sql, "ORDER BY");
    }

    [Fact]
    public void The_daily_counters_translate_to_a_group_by()
    {
        using var db = NpgsqlContext();
        var start = new DateTime(2024, 6, 1, 23, 0, 0, DateTimeKind.Utc);

        var sql = Sql(CommandeAdminService.CountersQuery(db, start, start.AddDays(1)));

        HasSql(sql, "GROUP BY");
    }

    // ---------- Tables ----------

    [Fact]
    public void The_admin_table_list_translates_with_its_order()
    {
        using var db = NpgsqlContext();

        HasSql(Sql(TableAdminService.ListQuery(db)), "ORDER BY");
    }

    [Fact]
    public void The_floor_plan_orders_query_translates_for_the_whole_room_and_for_one_table()
    {
        using var db = NpgsqlContext();

        var all = Sql(SalleService.TrackedOrdersQuery(db));
        var one = Sql(SalleService.TrackedOrdersQuery(db, 3));

        HasSql(all, "ORDER BY");
        HasSql(all, "WHERE");
        HasSql(one, "WHERE");
    }

    // ---------- Statistiques (Bloc 6c) ----------

    [Fact]
    public void The_statistics_queries_translate_to_sql()
    {
        using var db = NpgsqlContext();
        var start = new DateTime(2024, 5, 31, 23, 0, 0, DateTimeKind.Utc);
        var end = start.AddDays(30);

        HasSql(Sql(StatistiquesService.OrdersQuery(db, start, end)), "WHERE");
        HasSql(Sql(StatistiquesService.ItemsQuery(db, start, end)), "WHERE");
        HasSql(Sql(StatistiquesService.ArticleCategoriesQuery(db)), "FROM");
        HasSql(Sql(StatistiquesService.CategoriesQuery(db)), "FROM");
        HasSql(Sql(StatistiquesService.NewClientsQuery(db, start, end)), "WHERE");
    }

    // ---------- Favoris et adresses (Bloc 6d) ----------

    [Fact]
    public void The_favourites_queries_translate_with_the_article_join_and_the_order()
    {
        using var db = NpgsqlContext();

        var list = Sql(FavoriService.ListQuery(db, "user-1"));
        HasSql(list, "WHERE");
        HasSql(list, "ORDER BY");
        HasSql(Sql(FavoriService.IdsQuery(db, "user-1")), "ORDER BY");
    }

    [Fact]
    public void The_address_list_translates_with_the_default_first()
    {
        using var db = NpgsqlContext();

        var sql = Sql(AdresseService.ListQuery(db, "user-1"));

        HasSql(sql, "WHERE");
        HasSql(sql, "ORDER BY");
    }
}
