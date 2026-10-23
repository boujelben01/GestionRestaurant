# Mock API de développement

Faux back-end pour développer et capturer l'UI sans lancer l'API .NET. **État en mémoire** (perdu
au redémarrage). Hors bundle (jamais importé par `src/`), sans dépendance. Il reproduit les règles
du vrai back-end (plafond de 20 par ligne, 409 article indisponible, minimum de livraison, etc.)
mais n'est PAS le vrai back-end : le front n'a jamais été testé contre l'API réelle.

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

L'inscription (`/api/auth/register`) crée un compte en mémoire.

## Routes simulées

Menu et restaurant : `GET /api/menu?lang=` (`?fail=1` 500, `?empty=1` vide), `GET /api/restaurant`.
Tables : `GET /api/tables/{code}`.
Auth : `register`, `login`, `GET/PUT /api/auth/me`, `POST /api/auth/me/password`.
Panier : `GET /api/panier`, `POST /api/panier/items`, `PUT|DELETE /api/panier/items/{id}`,
`DELETE /api/panier`. Commandes : `POST /api/commandes`, `GET /api/commandes?page=&pageSize=`,
`GET /api/commandes/{id}`, `POST /api/commandes/{id}/annuler`.

Codes de table (QR, pages `/table/<code>`) :

- `11111111-1111-4111-8111-111111111111` → table 1
- `55555555-5555-4555-8555-555555555555` → table 5

## Contrôles de test (absents du vrai back-end)

```bash
curl -X POST localhost:5118/__mock/reset                                  # remet tout à zéro
curl -X POST localhost:5118/__mock/settings -H 'Content-Type: application/json' \
     -d '{"commandesOuvertes":false}'                                      # ou {"forceClosed":true}
curl -X POST localhost:5118/__mock/commandes/1/avancer                     # EnAttente → EnPreparation → Prete → Terminee
curl -X POST localhost:5118/__mock/commandes/1/statut -H 'Content-Type: application/json' \
     -d '{"statut":"Annulee"}'
curl -X POST localhost:5118/__mock/articles/disponibilite -H 'Content-Type: application/json' \
     -d '{"id":101,"disponible":false}'                                    # rend un plat indisponible
```

Penser à `/__mock/reset` entre deux scénarios : `settings` et la disponibilité des articles
persistent sinon (le reset ne remet PAS les disponibilités du menu : redémarrer le mock pour cela).

## Données

`fixtures/menu.json` : 7 catégories, 24 plats (ids 101…703), 1 indisponible (303), 6 populaires,
2 plats dont l'image lourde est volontairement remplacée par `default.svg`, 3 sans image.
`fixtures/restaurant.json` : dimanche fermé, samedi jusqu'à 02:00 (« après minuit »), frais de
livraison 3 DT, minimum de livraison 20 DT.
