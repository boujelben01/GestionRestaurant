# Resto

Application de gestion de restaurant : API ASP.NET Core 8 (`backend/`), PostgreSQL, frontend à venir (`frontend/`).

## Prérequis

- SDK .NET 8
- Outil EF Core : `dotnet tool install --global dotnet-ef --version 8.*`
- Une base PostgreSQL accessible (par exemple Neon)

## Configuration

Les valeurs se stockent dans les user-secrets du projet (`UserSecretsId` déjà défini dans `Resto.Api.csproj`) ou dans des variables d'environnement. Ne jamais les committer.

| Clé | Rôle |
| --- | --- |
| `ConnectionStrings:Default` | Chaîne de connexion PostgreSQL (obligatoire, l'API refuse de démarrer sans elle) |
| `Jwt:SecretKey` | Clé de signature des jetons JWT (utilisée à partir du bloc 2) |
| `Seed:AdminPassword` | Mot de passe du compte `admin` créé par le seed (sans lui, l'admin n'est pas créé) |

```powershell
cd backend/src/Resto.Api
dotnet user-secrets set "ConnectionStrings:Default" "<chaine-de-connexion>"
dotnet user-secrets set "Seed:AdminPassword" "<mot-de-passe>"
```

## Base de données et lancement

```powershell
cd backend
dotnet ef database update -p src/Resto.Api -s src/Resto.Api
cd src/Resto.Api
dotnet run
```

- API : http://localhost:5118 (Swagger sur `/swagger`, santé sur `/health`).
- En Development, le seed (rôles, admin, paramètres, horaires, tables, catalogue) s'exécute au démarrage ; les données ne sont insérées que si les tables sont vides.
- Hors Development, le seed ne tourne que sur demande : `dotnet run -- --seed` (il s'arrête ensuite).
- Aucune migration n'est appliquée automatiquement.
