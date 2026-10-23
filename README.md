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
| `Jwt:SecretKey` | Clé de signature HS256, 32 caractères minimum (l'API refuse de démarrer sinon) |
| `Jwt:Issuer`, `Jwt:Audience` | Non secrets, dans `appsettings.json` |
| `Jwt:AccessTokenMinutes` | Durée de vie du jeton (60 par défaut) |
| `Cors:AllowedOrigins` | Tableau des origines autorisées (défaut `http://localhost:5173`) |
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

## Authentification

Toutes les routes exigent un jeton `Authorization: Bearer <jwt>`, sauf `register`, `login` et `/health`. Exemples dans `backend/src/Resto.Api/Resto.Api.http`.

| Méthode | Route | Accès | Rôle |
| --- | --- | --- | --- |
| POST | `/api/auth/register` | Anonyme (10 req/min/IP) | Crée un compte Client, renvoie 201 |
| POST | `/api/auth/login` | Anonyme (10 req/min/IP) | Renvoie jeton, expiration et profil ; verrouillage 10 min après 5 échecs |
| GET | `/api/auth/me` | Authentifié | Profil du jeton |
| PUT | `/api/auth/me` | Authentifié | Modifie nom, téléphone, langue |
| POST | `/api/auth/me/password` | Authentifié | Change le mot de passe (ancien + nouveau) |
| GET | `/api/admin/users` | Admin | Liste paginée (`page`, `pageSize` ≤ 50, `search`) |
| PATCH | `/api/admin/users/{id}/actif` | Admin | Active ou désactive un compte (jamais le sien) |

Un compte désactivé est refusé à chaque requête, même avec un jeton encore valide. Les erreurs suivent RFC 7807 (`application/problem+json`).

## Menu et restaurant

Routes publiques (anonymes, GET). `lang=fr|ar` (défaut `fr`, repli sur le français si la traduction est vide). Le menu est servi avec `Cache-Control: public, max-age=60` : une modification admin peut mettre jusqu'à 60 s à apparaître.

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/menu` | Catégories actives avec leurs articles actifs |
| GET | `/api/menu/categories` | Catégories actives |
| GET | `/api/menu/articles` | Articles paginés (`categorieId`, `populaire`, `recherche`, `page`, `pageSize` ≤ 50) |
| GET | `/api/menu/articles/{id}` | Détail d'un article |
| GET | `/api/restaurant` | Paramètres, horaires des 7 jours, `ouvertMaintenant` (fuseau Africa/Tunis) |

Un article indisponible reste visible (`disponible: false`). Un article inactif, ou dont la catégorie est inactive, n'est jamais renvoyé.

Administration (rôle Admin). Il n'y a aucune route DELETE : « supprimer » = désactiver.

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET, POST | `/api/admin/categories` | Liste complète (inactives incluses), création |
| GET, PUT | `/api/admin/categories/{id}` | Détail, modification |
| PATCH | `/api/admin/categories/{id}/active` | Active/désactive (409 si articles actifs) |
| PUT | `/api/admin/categories/ordre` | Réordonne : `{ "ids": [..] }` dans le nouvel ordre |
| GET, POST | `/api/admin/articles` | Liste paginée (`categorieId`, `actif`, `disponible`, `recherche`), création |
| GET, PUT | `/api/admin/articles/{id}` | Détail, modification |
| PATCH | `/api/admin/articles/{id}/disponible` | Disponible ou non |
| PATCH | `/api/admin/articles/{id}/actif` | Active/désactive |
| PUT | `/api/admin/articles/ordre` | Réordonne (articles d'une même catégorie) |
| PUT | `/api/admin/restaurant` | Paramètres (frais, minimum, téléphone, e-mail, adresse) |
| PUT | `/api/admin/restaurant/horaires` | Remplace les 7 horaires (`HH:mm`, `jourSemaine` 0 = dimanche à 6 = samedi) |
| PATCH | `/api/admin/restaurant/commandes-ouvertes` | Ouvre ou ferme la prise de commandes |

`ImageUrl` : chemin relatif `/images/<nom>` (lettres, chiffres, `.`, `_`, `-`) ou URL `https`. Une fermeture antérieure à l'ouverture signifie une fermeture après minuit.

## Panier et commandes

Toutes ces routes exigent un compte connecté. **Décision assumée : les invités anonymes ne peuvent pas commander** (la FallbackPolicy exige un jeton) ; un client sur place doit créer un compte, puis scanner le QR de sa table. L'identité vient toujours du jeton : aucun `userId` ni `panierId` n'est lu dans les requêtes.

| Méthode | Route | Rôle |
| --- | --- | --- |
| GET | `/api/panier?lang=` | Panier (créé à la volée) : lignes, prix courants, sous-total, `avertissement` par ligne (`inactif`, `indisponible`) |
| POST | `/api/panier/items` | `{articleId, quantite}` : ajoute et cumule (plafond 20) |
| PUT | `/api/panier/items/{articleId}` | `{quantite}` (1 à 20) : fixe la quantité |
| DELETE | `/api/panier/items/{articleId}` | Retire la ligne (idempotent) |
| DELETE | `/api/panier` | Vide le panier (idempotent) |
| POST | `/api/commandes` | `{typeCommande, telephone, note?, adresseLivraison?, tableCode?}` : crée la commande depuis le panier |
| GET | `/api/commandes` | Mes commandes, paginées (`page`, `pageSize` ≤ 50), plus récentes d'abord |
| GET | `/api/commandes/{id}` | Détail avec lignes et historique (404 si la commande d'un autre) |
| POST | `/api/commandes/{id}/annuler` | Annule une commande `EnAttente` (409 sinon) |
| GET | `/api/tables/{code}` | Anonyme : `{numero}` d'une table active, sinon 404 |

Les énumérations (`typeCommande`, `statut`...) s'échangent en chaînes : `SurPlace`, `ARemporter`, `Livraison` ; `EnAttente`, `EnPreparation`, `Prete`, `Terminee`, `Annulee`.

Règles métier de `POST /api/commandes` :

- Refus (409) si `CommandesOuvertes` est faux ou si le restaurant est fermé (horaires, fuseau Africa/Tunis).
- Panier vide : 400. Article devenu inactif ou indisponible : 409 avec la liste des articles, le panier reste intact.
- `Livraison` : adresse de 10 à 500 caractères, sous-total ≥ montant minimum (sinon 400), frais = paramètre du restaurant. Les autres types : frais = 0.
- `SurPlace` : `tableCode` (Guid du QR) d'une table active obligatoire. `ARemporter` : ni adresse ni table. Un champ non applicable au type est refusé (400).
- Sous-total, frais et total sont recalculés côté serveur (2 décimales, arrondi « away from zero ») ; les prix sont lus en base, jamais envoyés par le client. Paiement : espèces, `estPayee = false`.
- Les lignes copient `NomFr`, `NomAr` et le prix au moment de la commande. Numéro `CMD-000123` dérivé de l'identifiant.

**Anti-doublon.** La création s'exécute dans une seule transaction (via la stratégie d'exécution EF, car `EnableRetryOnFailure` est actif). Elle commence par `SELECT ... FOR UPDATE` sur la ligne du panier de l'utilisateur : deux requêtes simultanées (ou un double clic) sont sérialisées, la seconde lit un panier déjà vidé par la première et reçoit 400 « panier vide ». Le panier est vidé dans la même transaction que la création. Si PostgreSQL signale un échec transitoire après le commit, la nouvelle tentative trouve un panier vide (400) plutôt que de créer un doublon. L'annulation s'appuie sur `xmin` : une modification concurrente donne un 409.

## Tests

```powershell
cd backend
dotnet test
```

Les tests d'intégration utilisent un fournisseur EF InMemory : il ne reproduit pas les contraintes PostgreSQL (CHECK, index uniques, clés étrangères). Ils ne vérifient que l'autorisation et le flux d'authentification.
