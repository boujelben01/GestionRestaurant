using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Resto.Api.Common;
using Resto.Api.Domain;

namespace Resto.Api.Data;

public static class DbSeeder
{
    private const string DefaultImage = "/images/default.svg";

    public static async Task SeedAsync(IServiceProvider services)
    {
        var db = services.GetRequiredService<AppDbContext>();
        var logger = services.GetRequiredService<ILoggerFactory>().CreateLogger(nameof(DbSeeder));

        await SeedRolesAsync(services.GetRequiredService<RoleManager<IdentityRole>>());
        await SeedAdminAsync(
            services.GetRequiredService<UserManager<ApplicationUser>>(),
            services.GetRequiredService<IConfiguration>(),
            logger);

        if (!await db.ParametresRestaurant.AnyAsync())
        {
            db.ParametresRestaurant.Add(new ParametresRestaurant
            {
                Id = 1,
                Nom = "Resto",
                Telephone = "+216 70 000 000",
                Email = "contact@resto.local",
                Adresse = "Avenue Habib Bourguiba, Tunis",
                FraisLivraison = 3m,
                MontantMinimumLivraison = 15m,
                CommandesOuvertes = true
            });
        }

        if (!await db.Horaires.AnyAsync())
        {
            db.Horaires.AddRange(Enumerable.Range(0, 7).Select(jour => new Horaire
            {
                JourSemaine = jour,
                Ouverture = new TimeOnly(11, 0),
                Fermeture = new TimeOnly(23, 0),
                EstFerme = false
            }));
        }

        if (!await db.Tables.AnyAsync())
        {
            int[] capacites = [2, 2, 4, 4, 6, 8];
            db.Tables.AddRange(capacites.Select((capacite, i) => new RestaurantTable
            {
                Numero = i + 1,
                Code = Guid.NewGuid(),
                Capacite = capacite,
                EstActive = true
            }));
        }

        if (!await db.Categories.AnyAsync() && !await db.Articles.AnyAsync())
        {
            SeedCatalogue(db);
        }

        await db.SaveChangesAsync();
    }

    private static async Task SeedRolesAsync(RoleManager<IdentityRole> roleManager)
    {
        foreach (var role in new[] { Roles.Admin, Roles.Client })
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                (await roleManager.CreateAsync(new IdentityRole(role))).ThrowIfFailed($"création du rôle {role}");
            }
        }
    }

    private static async Task SeedAdminAsync(UserManager<ApplicationUser> userManager, IConfiguration config, ILogger logger)
    {
        if (await userManager.FindByNameAsync("admin") is not null)
        {
            return;
        }

        var password = config["Seed:AdminPassword"];
        if (string.IsNullOrWhiteSpace(password))
        {
            logger.LogWarning("Seed:AdminPassword est absent : le compte admin n'est pas créé.");
            return;
        }

        var admin = new ApplicationUser
        {
            UserName = "admin",
            Email = "admin@resto.local",
            EmailConfirmed = true,
            Nom = "Administrateur"
        };
        (await userManager.CreateAsync(admin, password)).ThrowIfFailed("création du compte admin");
        (await userManager.AddToRoleAsync(admin, Roles.Admin)).ThrowIfFailed("attribution du rôle Admin");
    }

    private static void ThrowIfFailed(this IdentityResult result, string action)
    {
        if (!result.Succeeded)
        {
            throw new InvalidOperationException(
                $"Échec ({action}) : {string.Join(", ", result.Errors.Select(e => e.Code))}");
        }
    }

    private static void SeedCatalogue(AppDbContext db)
    {
        var entrees = new Categorie { NomFr = "Entrées", NomAr = "المقبلات", Ordre = 1 };
        var sandwichs = new Categorie { NomFr = "Sandwichs", NomAr = "السندويشات", Ordre = 2 };
        var plats = new Categorie { NomFr = "Plats", NomAr = "الأطباق", Ordre = 3 };
        var pizzas = new Categorie { NomFr = "Pizzas", NomAr = "البيتزا", Ordre = 4 };
        var salades = new Categorie { NomFr = "Salades", NomAr = "السلطات", Ordre = 5 };
        var desserts = new Categorie { NomFr = "Desserts et glaces", NomAr = "الحلويات والمثلجات", Ordre = 6 };
        var boissons = new Categorie { NomFr = "Boissons", NomAr = "المشروبات", Ordre = 7 };

        var articles = new List<Article>
        {
            Plat(entrees, "Brik à l'œuf", "بريك بالبيض", 3.5m, null,
                "Feuille de brik croustillante, œuf, thon, câpres et persil.", "ورقة بريك مقرمشة بالبيض والتن والقبار والمعدنوس.", true),
            Plat(entrees, "Brik au thon", "بريك بالتن", 4m, null,
                "Brik farci au thon, pommes de terre et fromage.", "بريك محشي بالتن والبطاطا والجبن."),
            Plat(entrees, "Lablabi", "لبلابي", 5m, "lablabi.webp",
                "Soupe de pois chiches à l'ail, cumin et harissa, avec pain, œuf et thon.", "شربة الحمص بالثوم والكمون والهريسة مع الخبز والبيض والتن.", true),
            Plat(entrees, "Chorba frik", "شربة فريك", 4.5m, null,
                "Soupe d'agneau au blé vert concassé.", "شربة بلحم العلوش والفريك."),

            Plat(sandwichs, "Makloub poulet", "مقلوب دجاج", 9m, "makloub.png",
                "Pain makloub garni de poulet grillé, fromage, salade et frites.", "خبز مقلوب بالدجاج المشوي والجبن والسلطة والبطاطا.", true),
            Plat(sandwichs, "Makloub viande hachée", "مقلوب كفتة", 9.5m, "makloub.png",
                "Makloub à la viande hachée épicée, fromage et crudités.", "مقلوب بالكفتة والجبن والخضرة."),
            Plat(sandwichs, "Chawarma poulet", "شاورما دجاج", 8.5m, "chawarma.jpg",
                "Pain libanais, poulet mariné, sauce à l'ail et pickles.", "خبز لبناني بالدجاج المتبل وصلصة الثوم والمخلل.", true),
            Plat(sandwichs, "Chawarma viande", "شاورما لحم", 10m, "chawarma.jpg",
                "Chawarma de bœuf, tahini, tomates et oignons.", "شاورما لحم بقري بالطحينة والطماطم والبصل."),
            Plat(sandwichs, "Fricassé", "فريكاسي", 1.5m, null,
                "Petit beignet salé farci au thon, œuf, olives et harissa.", "خبزة مقلية محشية بالتن والبيض والزيتون والهريسة."),
            Plat(sandwichs, "Casse-croûte thon", "كسكروت بالتن", 5m, null,
                "Baguette au thon, olives, œuf, harissa et salade méchouia.", "باغيت بالتن والزيتون والبيض والهريسة والسلطة المشوية."),

            Plat(plats, "Plat tounsi", "صحن تونسي", 14m, "plat-tounsi.jpg",
                "Assiette tunisienne : grillades, salade méchouia, frites et œuf.", "صحن تونسي: مشاوي وسلطة مشوية وبطاطا وبيض.", true),
            Plat(plats, "Assiette chawarma", "صحن شاورما", 15m, "assiette-chawarma.jpg",
                "Chawarma servie avec frites, riz, salade et sauces.", "شاورما مع البطاطا والأرز والسلطة والصلصات."),
            Plat(plats, "Couscous à l'agneau", "كسكسي بالعلوش", 18m, null,
                "Couscous aux légumes, pois chiches et viande d'agneau.", "كسكسي بالخضرة والحمص ولحم العلوش."),
            Plat(plats, "Ojja merguez", "عجة بالمرقاز", 12m, null,
                "Œufs, merguez et sauce tomate pimentée.", "بيض ومرقاز في صلصة طماطم حارة."),
            Plat(plats, "Escalope panée", "اسكالوب مصلي", 13m, null,
                "Escalope de poulet panée, frites et salade.", "اسكالوب دجاج مصلي مع البطاطا والسلطة."),

            Plat(pizzas, "Pizza margherita", "بيتزا مارغريتا", 10m, "pizza.jpg",
                "Sauce tomate, mozzarella et basilic.", "صلصة طماطم وموزاريلا وريحان."),
            Plat(pizzas, "Pizza thon", "بيتزا بالتن", 12m, "pizza.jpg",
                "Tomate, mozzarella, thon et olives.", "طماطم وموزاريلا وتن وزيتون."),
            Plat(pizzas, "Pizza mixte", "بيتزا ميكس", 14m, "pizza.jpg",
                "Poivrons, champignons, olives et fromage.", "فلفل ومشروم وزيتون وجبن.", true),

            Plat(salades, "Salade tunisienne", "سلطة تونسية", 5m, null,
                "Tomates, concombre, oignon, olives et thon.", "طماطم وخيار وبصل وزيتون وتن."),
            Plat(salades, "Salade méchouia", "سلطة مشوية", 6m, null,
                "Poivrons et tomates grillés, ail et huile d'olive.", "فلفل وطماطم مشوية بالثوم وزيت الزيتون."),

            Plat(desserts, "Brownie glacé", "براوني بالمثلجات", 8m, "brownie.jpg",
                "Brownie au chocolat chaud et boule de glace vanille.", "براوني بالشوكولاطة مع كرة مثلجات فانيليا.", true),
            Plat(desserts, "Glace trois boules", "مثلجات ثلاث كرات", 6m, "glace.webp",
                "Trois boules au choix.", "ثلاث كرات حسب الاختيار."),
            Plat(desserts, "Makroudh", "مقروض", 2m, null,
                "Semoule fourrée aux dattes, frite et nappée de miel.", "سميد محشي بالتمر مقلي ومغموس في العسل."),
            Plat(desserts, "Assidet zgougou", "عصيدة زقوقو", 6m, null,
                "Crème de pignes d'Alep garnie de fruits secs.", "عصيدة الزقوقو بالمكسرات."),

            Plat(boissons, "Eau minérale", "ماء معدني", 1.5m, null, null, null),
            Plat(boissons, "Boisson gazeuse", "مشروب غازي", 2.5m, null, null, null),
            Plat(boissons, "Citronnade", "ليمونادة", 4m, null, null, null),
            Plat(boissons, "Jus d'orange pressé", "عصير برتقال", 5m, null, null, null),
            Plat(boissons, "Thé à la menthe", "أتاي بالنعناع", 2m, null, null, null),
            Plat(boissons, "Café express", "قهوة", 2m, null, null, null),
        };

        foreach (var group in articles.GroupBy(a => a.Categorie))
        {
            var ordre = 1;
            foreach (var article in group)
            {
                article.Ordre = ordre++;
            }
        }

        db.Categories.AddRange(entrees, sandwichs, plats, pizzas, salades, desserts, boissons);
        db.Articles.AddRange(articles);
    }

    private static Article Plat(Categorie categorie, string nomFr, string nomAr, decimal prix, string? image,
        string? descriptionFr, string? descriptionAr, bool populaire = false) => new()
    {
        Categorie = categorie,
        NomFr = nomFr,
        NomAr = nomAr,
        Prix = prix,
        ImageUrl = image is null ? DefaultImage : $"/images/{image}",
        DescriptionFr = descriptionFr,
        DescriptionAr = descriptionAr,
        EstPopulaire = populaire
    };
}
