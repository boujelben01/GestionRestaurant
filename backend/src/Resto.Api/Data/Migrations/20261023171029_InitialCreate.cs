using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Resto.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AspNetRoles",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoles", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUsers",
                columns: table => new
                {
                    Id = table.Column<string>(type: "text", nullable: false),
                    Nom = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true),
                    DateCreation = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    LangueFavorite = table.Column<string>(type: "character varying(2)", maxLength: 2, nullable: false, defaultValue: "fr"),
                    EstActif = table.Column<bool>(type: "boolean", nullable: false, defaultValueSql: "true"),
                    UserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedUserName = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    Email = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    NormalizedEmail = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
                    EmailConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    PasswordHash = table.Column<string>(type: "text", nullable: true),
                    SecurityStamp = table.Column<string>(type: "text", nullable: true),
                    ConcurrencyStamp = table.Column<string>(type: "text", nullable: true),
                    PhoneNumber = table.Column<string>(type: "text", nullable: true),
                    PhoneNumberConfirmed = table.Column<bool>(type: "boolean", nullable: false),
                    TwoFactorEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    LockoutEnd = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    LockoutEnabled = table.Column<bool>(type: "boolean", nullable: false),
                    AccessFailedCount = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUsers", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Categories",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    NomFr = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    NomAr = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    EstActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Categories", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Horaires",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    JourSemaine = table.Column<int>(type: "integer", nullable: false),
                    Ouverture = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    Fermeture = table.Column<TimeOnly>(type: "time without time zone", nullable: true),
                    EstFerme = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Horaires", x => x.Id);
                    table.CheckConstraint("CK_Horaires_JourSemaine", "\"JourSemaine\" BETWEEN 0 AND 6");
                });

            migrationBuilder.CreateTable(
                name: "ParametresRestaurant",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false),
                    Nom = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Telephone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Email = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    Adresse = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                    FraisLivraison = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    MontantMinimumLivraison = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    CommandesOuvertes = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ParametresRestaurant", x => x.Id);
                    table.CheckConstraint("CK_ParametresRestaurant_Singleton", "\"Id\" = 1");
                });

            migrationBuilder.CreateTable(
                name: "Tables",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Numero = table.Column<int>(type: "integer", nullable: false),
                    Code = table.Column<Guid>(type: "uuid", nullable: false),
                    Capacite = table.Column<int>(type: "integer", nullable: false),
                    EstActive = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tables", x => x.Id);
                    table.CheckConstraint("CK_Tables_Capacite", "\"Capacite\" > 0");
                });

            migrationBuilder.CreateTable(
                name: "AspNetRoleClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    RoleId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetRoleClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetRoleClaims_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Adresses",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    Libelle = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    Ligne = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    Ville = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Details = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    Telephone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EstParDefaut = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Adresses", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Adresses_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserClaims",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ClaimType = table.Column<string>(type: "text", nullable: true),
                    ClaimValue = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserClaims", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AspNetUserClaims_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserLogins",
                columns: table => new
                {
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    ProviderKey = table.Column<string>(type: "text", nullable: false),
                    ProviderDisplayName = table.Column<string>(type: "text", nullable: true),
                    UserId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserLogins", x => new { x.LoginProvider, x.ProviderKey });
                    table.ForeignKey(
                        name: "FK_AspNetUserLogins_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserRoles",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    RoleId = table.Column<string>(type: "text", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserRoles", x => new { x.UserId, x.RoleId });
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetRoles_RoleId",
                        column: x => x.RoleId,
                        principalTable: "AspNetRoles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AspNetUserRoles_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AspNetUserTokens",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    LoginProvider = table.Column<string>(type: "text", nullable: false),
                    Name = table.Column<string>(type: "text", nullable: false),
                    Value = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AspNetUserTokens", x => new { x.UserId, x.LoginProvider, x.Name });
                    table.ForeignKey(
                        name: "FK_AspNetUserTokens_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Paniers",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: false),
                    DateMiseAJour = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Paniers", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Paniers_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Articles",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CategorieId = table.Column<int>(type: "integer", nullable: false),
                    NomFr = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    NomAr = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    DescriptionFr = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    DescriptionAr = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    Prix = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    ImageUrl = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    EstDisponible = table.Column<bool>(type: "boolean", nullable: false),
                    EstActif = table.Column<bool>(type: "boolean", nullable: false),
                    EstPopulaire = table.Column<bool>(type: "boolean", nullable: false),
                    Ordre = table.Column<int>(type: "integer", nullable: false),
                    DateCreation = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    DateMiseAJour = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Articles", x => x.Id);
                    table.CheckConstraint("CK_Articles_Prix", "\"Prix\" >= 0");
                    table.ForeignKey(
                        name: "FK_Articles_Categories_CategorieId",
                        column: x => x.CategorieId,
                        principalTable: "Categories",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Commandes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    Numero = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    UserId = table.Column<string>(type: "text", nullable: true),
                    NomClient = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Telephone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Statut = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    TypeCommande = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    ModePaiement = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    EstPayee = table.Column<bool>(type: "boolean", nullable: false),
                    SousTotal = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    FraisLivraison = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Total = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    TableId = table.Column<int>(type: "integer", nullable: true),
                    AdresseLivraison = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    DateCommande = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    DateMiseAJour = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    xmin = table.Column<uint>(type: "xid", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Commandes", x => x.Id);
                    table.CheckConstraint("CK_Commandes_Livraison_Adresse", "\"TypeCommande\" <> 'Livraison' OR \"AdresseLivraison\" IS NOT NULL");
                    table.CheckConstraint("CK_Commandes_Statut", "\"Statut\" IN ('EnAttente', 'EnPreparation', 'Prete', 'Terminee', 'Annulee')");
                    table.CheckConstraint("CK_Commandes_SurPlace_Table", "\"TypeCommande\" <> 'SurPlace' OR \"TableId\" IS NOT NULL");
                    table.CheckConstraint("CK_Commandes_Total", "\"Total\" = \"SousTotal\" + \"FraisLivraison\"");
                    table.CheckConstraint("CK_Commandes_TypeCommande", "\"TypeCommande\" IN ('SurPlace', 'ARemporter', 'Livraison')");
                    table.ForeignKey(
                        name: "FK_Commandes_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Commandes_Tables_TableId",
                        column: x => x.TableId,
                        principalTable: "Tables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Reservations",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    UserId = table.Column<string>(type: "text", nullable: true),
                    NomClient = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    Telephone = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    DateHeure = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    NombrePersonnes = table.Column<int>(type: "integer", nullable: false),
                    Statut = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Note = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    TableId = table.Column<int>(type: "integer", nullable: true),
                    DateCreation = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()")
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reservations", x => x.Id);
                    table.CheckConstraint("CK_Reservations_NombrePersonnes", "\"NombrePersonnes\" BETWEEN 1 AND 20");
                    table.CheckConstraint("CK_Reservations_Statut", "\"Statut\" IN ('EnAttente', 'Confirmee', 'Refusee', 'Annulee')");
                    table.ForeignKey(
                        name: "FK_Reservations_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_Reservations_Tables_TableId",
                        column: x => x.TableId,
                        principalTable: "Tables",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "Favoris",
                columns: table => new
                {
                    UserId = table.Column<string>(type: "text", nullable: false),
                    ArticleId = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Favoris", x => new { x.UserId, x.ArticleId });
                    table.ForeignKey(
                        name: "FK_Favoris_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Favoris_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "PanierItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    PanierId = table.Column<int>(type: "integer", nullable: false),
                    ArticleId = table.Column<int>(type: "integer", nullable: false),
                    Quantite = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_PanierItems", x => x.Id);
                    table.CheckConstraint("CK_PanierItems_Quantite", "\"Quantite\" BETWEEN 1 AND 20");
                    table.ForeignKey(
                        name: "FK_PanierItems_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_PanierItems_Paniers_PanierId",
                        column: x => x.PanierId,
                        principalTable: "Paniers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CommandeItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CommandeId = table.Column<int>(type: "integer", nullable: false),
                    ArticleId = table.Column<int>(type: "integer", nullable: true),
                    NomFr = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    NomAr = table.Column<string>(type: "character varying(150)", maxLength: 150, nullable: false),
                    PrixUnitaire = table.Column<decimal>(type: "numeric(10,2)", nullable: false),
                    Quantite = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CommandeItems", x => x.Id);
                    table.CheckConstraint("CK_CommandeItems_Quantite", "\"Quantite\" > 0");
                    table.ForeignKey(
                        name: "FK_CommandeItems_Articles_ArticleId",
                        column: x => x.ArticleId,
                        principalTable: "Articles",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_CommandeItems_Commandes_CommandeId",
                        column: x => x.CommandeId,
                        principalTable: "Commandes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "HistoriqueStatuts",
                columns: table => new
                {
                    Id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    CommandeId = table.Column<int>(type: "integer", nullable: false),
                    Statut = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    Date = table.Column<DateTime>(type: "timestamp with time zone", nullable: false, defaultValueSql: "now()"),
                    ParUserId = table.Column<string>(type: "text", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_HistoriqueStatuts", x => x.Id);
                    table.CheckConstraint("CK_HistoriqueStatuts_Statut", "\"Statut\" IN ('EnAttente', 'EnPreparation', 'Prete', 'Terminee', 'Annulee')");
                    table.ForeignKey(
                        name: "FK_HistoriqueStatuts_AspNetUsers_ParUserId",
                        column: x => x.ParUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_HistoriqueStatuts_Commandes_CommandeId",
                        column: x => x.CommandeId,
                        principalTable: "Commandes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_Adresses_UserId",
                table: "Adresses",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Articles_CategorieId_Ordre",
                table: "Articles",
                columns: new[] { "CategorieId", "Ordre" });

            migrationBuilder.CreateIndex(
                name: "IX_AspNetRoleClaims_RoleId",
                table: "AspNetRoleClaims",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "RoleNameIndex",
                table: "AspNetRoles",
                column: "NormalizedName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserClaims_UserId",
                table: "AspNetUserClaims",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserLogins_UserId",
                table: "AspNetUserLogins",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_AspNetUserRoles_RoleId",
                table: "AspNetUserRoles",
                column: "RoleId");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                table: "AspNetUsers",
                column: "NormalizedEmail");

            migrationBuilder.CreateIndex(
                name: "UserNameIndex",
                table: "AspNetUsers",
                column: "NormalizedUserName",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Categories_NomFr",
                table: "Categories",
                column: "NomFr",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CommandeItems_ArticleId",
                table: "CommandeItems",
                column: "ArticleId");

            migrationBuilder.CreateIndex(
                name: "IX_CommandeItems_CommandeId",
                table: "CommandeItems",
                column: "CommandeId");

            migrationBuilder.CreateIndex(
                name: "IX_Commandes_Numero",
                table: "Commandes",
                column: "Numero",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Commandes_Statut_DateCommande",
                table: "Commandes",
                columns: new[] { "Statut", "DateCommande" });

            migrationBuilder.CreateIndex(
                name: "IX_Commandes_TableId",
                table: "Commandes",
                column: "TableId");

            migrationBuilder.CreateIndex(
                name: "IX_Commandes_UserId",
                table: "Commandes",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Favoris_ArticleId",
                table: "Favoris",
                column: "ArticleId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoriqueStatuts_CommandeId",
                table: "HistoriqueStatuts",
                column: "CommandeId");

            migrationBuilder.CreateIndex(
                name: "IX_HistoriqueStatuts_ParUserId",
                table: "HistoriqueStatuts",
                column: "ParUserId");

            migrationBuilder.CreateIndex(
                name: "IX_Horaires_JourSemaine",
                table: "Horaires",
                column: "JourSemaine",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_PanierItems_ArticleId",
                table: "PanierItems",
                column: "ArticleId");

            migrationBuilder.CreateIndex(
                name: "IX_PanierItems_PanierId_ArticleId",
                table: "PanierItems",
                columns: new[] { "PanierId", "ArticleId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Paniers_UserId",
                table: "Paniers",
                column: "UserId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_DateHeure",
                table: "Reservations",
                column: "DateHeure");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_TableId",
                table: "Reservations",
                column: "TableId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_UserId",
                table: "Reservations",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Tables_Code",
                table: "Tables",
                column: "Code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Tables_Numero",
                table: "Tables",
                column: "Numero",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Adresses");

            migrationBuilder.DropTable(
                name: "AspNetRoleClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserClaims");

            migrationBuilder.DropTable(
                name: "AspNetUserLogins");

            migrationBuilder.DropTable(
                name: "AspNetUserRoles");

            migrationBuilder.DropTable(
                name: "AspNetUserTokens");

            migrationBuilder.DropTable(
                name: "CommandeItems");

            migrationBuilder.DropTable(
                name: "Favoris");

            migrationBuilder.DropTable(
                name: "HistoriqueStatuts");

            migrationBuilder.DropTable(
                name: "Horaires");

            migrationBuilder.DropTable(
                name: "PanierItems");

            migrationBuilder.DropTable(
                name: "ParametresRestaurant");

            migrationBuilder.DropTable(
                name: "Reservations");

            migrationBuilder.DropTable(
                name: "AspNetRoles");

            migrationBuilder.DropTable(
                name: "Commandes");

            migrationBuilder.DropTable(
                name: "Articles");

            migrationBuilder.DropTable(
                name: "Paniers");

            migrationBuilder.DropTable(
                name: "Tables");

            migrationBuilder.DropTable(
                name: "Categories");

            migrationBuilder.DropTable(
                name: "AspNetUsers");
        }
    }
}
