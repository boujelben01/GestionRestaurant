# Mock API de développement

Faux back-end pour développer et capturer l'UI sans lancer l'API .NET. **État en mémoire** (perdu
au redémarrage). Hors bundle (jamais importé par `src/`), sans dépendance. Il reproduit les règles
du vrai back-end (plafond de 20 par ligne, 409 article indisponible, minimum de livraison,
transitions de statut, etc.) mais **n'est PAS le vrai back-end ; le front n'a jamais été testé
contre l'API réelle.**

```bash
npm run mock:api                                  # http://localhost:5118
VITE_API_URL=http://localhost:5118 npm run dev    # front sur 5173
```

- Port : `PORT=5119 npm run mock:api` (le script s'arrête si le port est pris : ne jamais le lancer
  en même temps que le vrai back-end sur 5118). Penser alors à `VITE_API_URL`.
- CORS : autorise `http://localhost:5173` (`ALLOWED_ORIGIN` pour changer).
- `MOCK_ALWAYS_OPEN=1` ignore les horaires (pour commander le dimanche ou la nuit).
- `TOKEN_TTL_MS=10000` raccourcit la durée du jeton (test de l'expiration).
- `MOCK_DELAY_MS=800` (ou `?delay=800` sur l'URL) ajoute de la latence.

## Comptes

| Compte               | Mot de passe     | Rôle   |
| -------------------- | ---------------- | ------ |
| `client@example.com` | `MotDePasse123!` | Client |
| `admin@example.com`  | `MotDePasse123!` | Admin  |

L'inscription (`/api/auth/register`) crée un compte en mémoire. 10 clients fictifs tunisiens
(`fixtures/users.json`, mot de passe `MotDePasse123!`) servent à tester la pagination admin.
Un compte désactivé reçoit `403 « Ce compte est désactivé. »` à la connexion et ses jetons
existants sont refusés (`401`).

## Routes simulées

Menu et restaurant : `GET /api/menu?lang=` (`?fail=1` 500, `?empty=1` vide), `GET /api/restaurant`.
Le menu public ignore les catégories et articles inactifs ; un article indisponible reste visible
(`disponible:false`). Il reflète les modifications admin (nom, prix, ordre, disponibilité).
Tables : `GET /api/tables/{code}` → `{numero}` pour une table ACTIVE dont le code courant correspond
(insensible à la casse), sinon `404 « Table introuvable. »` (inconnue, inactive ou ancien code).
Auth : `register`, `login`, `GET/PUT /api/auth/me`, `POST /api/auth/me/password`.
Panier : `GET /api/panier`, `POST /api/panier/items`, `PUT|DELETE /api/panier/items/{id}`,
`DELETE /api/panier`. Commandes : `POST /api/commandes`, `GET /api/commandes?page=&pageSize=`,
`GET /api/commandes/{id}`, `POST /api/commandes/{id}/annuler`.

### Routes ADMIN (401 sans jeton, 403 si pas le rôle Admin)

- Commandes (`/api/admin/commandes`) : `GET ?statut=&typeCommande=&estPayee=&du=&au=&recherche=&page=&pageSize=`
  (`statut` répétable ou `A,B`, insensible à la casse ; `du`/`au` en `AAAA-MM-JJ` = jour UTC entier
  ou date-heure ISO ; valeurs invalides = 400 par champ), `GET /actives` (écran cuisine),
  `GET /compteurs` (jour civil Africa/Tunis), `GET /{id}`, `PATCH /{id}/statut` `{statut, version?}`
  (EnAttente → EnPreparation|Annulee, EnPreparation → Prete|Annulee, Prete → Terminee|Annulee ;
  statut identique = 200 idempotent ; transition interdite ou `version` périmée = 409),
  `PATCH /{id}/paiement` `{estPayee}` (409 si annulée).
- Catégories (`/api/admin/categories`) : `GET`, `GET /{id}`, `POST`, `PUT /{id}`,
  `PATCH /{id}/active` `{estActive}` (409 s'il reste des articles actifs), `PUT /ordre` `{ids}`.
- Articles (`/api/admin/articles`) : `GET ?categorieId=&actif=&disponible=&recherche=&page=&pageSize=`,
  `GET /{id}`, `POST`, `PUT /{id}`, `PATCH /{id}/disponible` `{estDisponible}`,
  `PATCH /{id}/actif` `{estActif}`, `PUT /ordre` `{ids}` (même catégorie). Pas de DELETE.
- Restaurant : `PUT /api/admin/restaurant`, `PUT /api/admin/restaurant/horaires`,
  `PATCH /api/admin/restaurant/commandes-ouvertes` `{commandesOuvertes}` ; renvoient le même objet
  que `GET /api/restaurant`, qui reflète ensuite les changements.
- Utilisateurs : `GET /api/admin/users?page=&pageSize=&search=`, `PATCH /api/admin/users/{id}/actif`
  `{estActif}` (400 si l'admin se désactive lui-même, 404 si inconnu).

Les erreurs sont des ProblemDetails `{status, title, errors?}` ; les clés d'erreurs de champ des
corps de requête sont en PascalCase (`NomFr`, `Prix`, `Horaires[0].Ouverture`...).

- Tables (`/api/admin/tables`) : `GET` (toutes, inactives incluses, triées par numéro puis id),
  `GET /{id}` (404), `POST {numero?, capacite}` (numéro par défaut max+1 ; numéro 1..9999 et
  capacité 1..50 sinon 400 par champ `Numero`/`Capacite` ; 409 « La table n° X existe déjà. » ;
  `code` = nouveau GUID ; 201), `PUT /{id}` `{numero, capacite}` (409 si le numéro est celui d'une
  autre table), `PATCH /{id}/active` `{estActive}` (idempotent), `POST /{id}/regenerer-code`
  (nouveau GUID, l'ancien renvoie 404). Objet : `{id, numero, code, capacite, estActive}`. Pas de
  DELETE. Une commande SurPlace sur une table inconnue ou inactive = 400 `TableCode`.
  (Écart : le numéro d'une commande est copié à la création, il ne suit pas un changement de numéro.)

- Plan de salle : `GET /api/admin/tables/salle` (toutes les tables triées par numéro :
  `{id, numero, capacite, estActive, etat, totalAEncaisser, nombreCommandes, premiereCommandeUtc,
commandes:[{id, numero, statut, total, estPayee, dateCommande}]}`). Commandes à suivre = SurPlace de
  la table, ni Annulee ni (Terminee et payée), triées par date. États : `Inactive` (prioritaire),
  `Occupee` (au moins une EnAttente/EnPreparation/Prete), `AEncaisser` (rien en cours mais au moins
  une non payée), `Libre`. `totalAEncaisser` = total des commandes à suivre non payées.
  `POST /api/admin/tables/{id}/encaisser` : marque payées toutes les SurPlace non payées et non
  annulées (409 « n'a rien à encaisser » sinon, 404 si inconnue). `POST /{id}/liberer` : 409 détaillé
  s'il reste des EnAttente/EnPreparation ou des non payées (rien n'est modifié) ; sinon les Prete
  passent Terminee (historique + version) ; table déjà libre = 200 sans effet. Renvoient l'entrée de
  salle. Les commandes SurPlace mémorisent `tableId` en plus du numéro copié.

Tables initiales (QR, pages `/table/<code>`), remises à zéro par `/__mock/reset` :

- `11111111-1111-4111-8111-111111111111` → table n° 1, 4 places, active
- `55555555-5555-4555-8555-555555555555` → table n° 5, 6 places, active
- `22222222-2222-4222-8222-222222222222` → table n° 2, 2 places, active
- `33333333-3333-4333-8333-333333333333` → table n° 3, 4 places, INACTIVE (404 sur `/api/tables/{code}`)

## Contrôles de test (absents du vrai back-end)

- `POST /__mock/salle/seed` : commandes SurPlace de démo (client@example.com, dates sur ~90 min) :
  table 1 = Occupee (EnPreparation non payée + Prete payée), table 2 = Libre, table 5 = AEncaisser
  (deux Terminee non payées), table 3 (inactive) = une EnAttente. Non idempotent : un appel répété
  ajoute des doublons (`/__mock/reset` pour repartir de zéro). Renvoie `{ids}`.

```bash
curl -X POST localhost:5118/__mock/reset                                  # remet tout à zéro
curl -X POST localhost:5118/__mock/settings -H 'Content-Type: application/json' \
     -d '{"commandesOuvertes":false}'                                      # ou {"forceClosed":true}
curl -X POST localhost:5118/__mock/seed -H 'Content-Type: application/json' \
     -d '{"count":4}'                                                      # commandes de démo, renvoie {ids}
curl -X POST localhost:5118/__mock/commandes/new -H 'Content-Type: application/json' \
     -d '{"typeCommande":"SurPlace","tableNumero":1,"note":"Vite !"}'      # nouvelle commande EnAttente « entrante »
curl -X POST localhost:5118/__mock/commandes/1/avancer                     # EnAttente → EnPreparation → Prete → Terminee
curl -X POST localhost:5118/__mock/commandes/1/statut -H 'Content-Type: application/json' \
     -d '{"statut":"Annulee"}'
curl -X POST localhost:5118/__mock/articles/disponibilite -H 'Content-Type: application/json' \
     -d '{"id":101,"disponible":false}'                                    # rend un plat indisponible
```

- `/__mock/reset` remet à l'état initial : utilisateurs (dont `estActif`), sessions (tous les jetons
  sont invalidés : se reconnecter), paniers, commandes, **menu** (catégories, articles,
  disponibilités, ordre, rechargés depuis `fixtures/menu.json`), **restaurant** (rechargé depuis
  `fixtures/restaurant.json`) et réglages (`commandesOuvertes`, `forceClosed`).
- `/__mock/seed` (`count` 4 par défaut, 50 max) crée des commandes EnAttente / EnPreparation /
  Prete / Terminee, types variés (dont Livraison et SurPlace table 1), une partie avec note, dates
  étalées sur les dernières heures. Elles appartiennent au compte `client@example.com` mais
  portent chacune un autre `nomClient`/`telephone` (instantané, comme dans le vrai back-end).
- `/__mock/commandes/new` accepte `typeCommande`, `tableNumero`, `nomClient`, `telephone`, `note`,
  `adresseLivraison`, `lignes:[{articleId, quantite}]` (tous facultatifs) ; renvoie la commande
  au format admin.

## Données

`fixtures/menu.json` : 7 catégories, 24 plats (ids 101…703), 1 indisponible (303), 6 populaires,
2 plats dont l'image lourde est volontairement remplacée par `default.svg`, 3 sans image. Les
champs `estActive`/`estActif` n'y figurent pas : ils valent `true` au chargement.
`fixtures/restaurant.json` : dimanche fermé, samedi jusqu'à 02:00 (« après minuit »), frais de
livraison 3 DT, minimum de livraison 20 DT. `commandesOuvertes` y est la valeur initiale ;
ensuite la source de vérité est le réglage en mémoire.
`fixtures/users.json` : 10 clients fictifs.
