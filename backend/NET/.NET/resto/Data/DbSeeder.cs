using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using resto.Models;

namespace resto.Data
{
    public class DbSeeder
    {
        public const string RoleAdmin = "Admin";
        public const string RoleClient = "Client";
        private const string AdminUserName = "admin";
        private const string AdminEmail = "admin@resto.local";

        private readonly ApplicationDbContext _context;
        private readonly UserManager<ApplicationUser> _userManager;
        private readonly RoleManager<IdentityRole> _roleManager;
        private readonly IConfiguration _configuration;
        private readonly ILogger<DbSeeder> _logger;

        public DbSeeder(
            ApplicationDbContext context,
            UserManager<ApplicationUser> userManager,
            RoleManager<IdentityRole> roleManager,
            IConfiguration configuration,
            ILogger<DbSeeder> logger)
        {
            _context = context;
            _userManager = userManager;
            _roleManager = roleManager;
            _configuration = configuration;
            _logger = logger;
        }

        public async Task SeedAsync()
        {
            await SeedRolesAsync();
            await SeedAdminAsync();
            await SeedMenuAsync();
        }

        private async Task SeedRolesAsync()
        {
            foreach (var role in new[] { RoleAdmin, RoleClient })
            {
                if (!await _roleManager.RoleExistsAsync(role))
                {
                    await _roleManager.CreateAsync(new IdentityRole(role));
                }
            }
        }

        private async Task SeedAdminAsync()
        {
            var password = _configuration["Seed:AdminPassword"];
            var admin = await _userManager.FindByNameAsync(AdminUserName);

            if (admin == null)
            {
                if (string.IsNullOrWhiteSpace(password))
                {
                    _logger.LogWarning("Seed:AdminPassword est absent de la configuration : l'utilisateur admin n'est pas créé.");
                    return;
                }

                admin = new ApplicationUser
                {
                    UserName = AdminUserName,
                    Email = AdminEmail,
                    EmailConfirmed = true,
                    Nom = "Administrateur"
                };
                var result = await _userManager.CreateAsync(admin, password);
                if (!result.Succeeded)
                {
                    _logger.LogError("Création de l'utilisateur admin impossible : {Erreurs}",
                        string.Join(", ", result.Errors.Select(e => e.Code)));
                    return;
                }
            }

            if (!await _userManager.IsInRoleAsync(admin, RoleAdmin))
            {
                await _userManager.AddToRoleAsync(admin, RoleAdmin);
            }
        }

        private async Task SeedMenuAsync()
        {
            foreach (var (categorieData, ordre) in Menu.Select((c, i) => (c, i + 1)))
            {
                var categorie = await _context.Categories.FirstOrDefaultAsync(c => c.Nom == categorieData.Nom);
                if (categorie == null)
                {
                    categorie = new Categorie { Nom = categorieData.Nom, Ordre = ordre };
                    _context.Categories.Add(categorie);
                    await _context.SaveChangesAsync();
                }

                var existants = await _context.Articles
                    .Where(a => a.CategorieId == categorie.Id)
                    .Select(a => a.Nom)
                    .ToListAsync();

                foreach (var (article, ordreArticle) in categorieData.Articles.Select((a, i) => (a, i + 1)))
                {
                    if (existants.Contains(article.Nom)) continue;

                    _context.Articles.Add(new Article
                    {
                        Nom = article.Nom,
                        Description = article.Description,
                        Prix = article.Prix,
                        ImageUrl = string.Empty,
                        Ordre = ordreArticle,
                        CategorieId = categorie.Id
                    });
                }
                await _context.SaveChangesAsync();
            }
        }

        private record ArticleSeed(string Nom, string Description, decimal Prix);
        private record CategorieSeed(string Nom, ArticleSeed[] Articles);

        private static readonly CategorieSeed[] Menu =
        {
            new("Makloub", new ArticleSeed[]
            {
                new("Makloub poulet", "Pain galette garni de poulet grillé, salade et harissa", 9.5m),
                new("Makloub escalope", "Escalope panée, fromage fondu et sauce maison", 10.5m),
                new("Makloub viande hachée", "Viande hachée épicée, oignons et frites", 10m),
                new("Makloub thon", "Thon, œuf, olives et salade fraîche", 9m)
            }),
            new("Lablebi", new ArticleSeed[]
            {
                new("Lablebi classique", "Soupe de pois chiches à l'ail, cumin et huile d'olive", 6m),
                new("Lablebi à l'œuf", "Lablebi avec œuf poché, thon et câpres", 7.5m),
                new("Lablebi au thon", "Lablebi garni de thon, olives et harissa", 8m)
            }),
            new("Plat tounsi", new ArticleSeed[]
            {
                new("Couscous à l'agneau", "Couscous aux légumes de saison et viande d'agneau", 18m),
                new("Ojja merguez", "Œufs mijotés à la sauce tomate piquante et merguez", 12m),
                new("Kafteji", "Légumes frits émincés, œuf et épices", 9m),
                new("Poisson grillé", "Poisson du jour grillé avec salade méchouia", 22m)
            }),
            new("Brik", new ArticleSeed[]
            {
                new("Brik à l'œuf", "Feuille de malsouka croustillante, œuf, thon et persil", 4.5m),
                new("Brik à la viande", "Viande hachée, oignons et câpres", 5m),
                new("Brik aux fruits de mer", "Crevettes et calamars à la sauce épicée", 7m)
            }),
            new("Chawarma", new ArticleSeed[]
            {
                new("Chawarma poulet", "Poulet mariné, sauce à l'ail et cornichons", 8m),
                new("Chawarma viande", "Viande de bœuf grillée, tahini et légumes", 9m),
                new("Assiette chawarma", "Chawarma, frites, salade et sauces", 14m)
            }),
            new("Pizza", new ArticleSeed[]
            {
                new("Pizza margherita", "Sauce tomate, mozzarella et basilic", 11m),
                new("Pizza thon", "Thon, olives, fromage et oignons", 13m),
                new("Pizza quatre fromages", "Mozzarella, emmental, chèvre et parmesan", 15m),
                new("Pizza végétarienne", "Poivrons, champignons, olives et maïs", 12.5m)
            }),
            new("Desserts", new ArticleSeed[]
            {
                new("Makroudh", "Gâteau de semoule fourré aux dattes", 3.5m),
                new("Baklawa", "Pâte feuilletée aux amandes et pistaches", 4m),
                new("Assidat zgougou", "Crème de graines de pin d'Alep et noisettes", 5m),
                new("Salade de fruits", "Fruits de saison frais", 5.5m)
            }),
            new("Glaces", new ArticleSeed[]
            {
                new("Glace vanille", "Deux boules de glace à la vanille", 4m),
                new("Glace chocolat", "Deux boules de glace au chocolat", 4m),
                new("Coupe fruits", "Glace panachée, fruits frais et chantilly", 7m)
            }),
            new("Boissons", new ArticleSeed[]
            {
                new("Thé à la menthe", "Thé vert à la menthe fraîche", 2m),
                new("Thé aux pignons", "Thé parfumé aux pignons de pin", 4m),
                new("Citronnade", "Citron pressé et menthe", 3.5m),
                new("Eau minérale", "Bouteille 50 cl", 1.5m),
                new("Boisson gazeuse", "Canette 33 cl", 2.5m)
            })
        };
    }
}
