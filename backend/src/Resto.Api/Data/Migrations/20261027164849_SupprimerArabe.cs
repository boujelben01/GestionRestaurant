using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Resto.Api.Data.Migrations
{
    /// <inheritdoc />
    public partial class SupprimerArabe : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "NomAr",
                table: "CommandeItems");

            migrationBuilder.DropColumn(
                name: "NomAr",
                table: "Categories");

            migrationBuilder.DropColumn(
                name: "DescriptionAr",
                table: "Articles");

            migrationBuilder.DropColumn(
                name: "NomAr",
                table: "Articles");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "NomAr",
                table: "CommandeItems",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NomAr",
                table: "Categories",
                type: "character varying(100)",
                maxLength: 100,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "DescriptionAr",
                table: "Articles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "NomAr",
                table: "Articles",
                type: "character varying(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");
        }
    }
}
