# Mock API de développement

Faux back-end en lecture seule pour développer et capturer l'UI sans lancer l'API .NET.
Hors bundle (jamais importé par `src/`), sans dépendance.

```bash
npm run mock:api                                  # http://localhost:5118
VITE_API_URL=http://localhost:5118 npm run dev    # front sur 5173
```

- Port : `PORT=5119 npm run mock:api` (le script s'arrête si le port est pris : ne jamais le
  lancer en même temps que le vrai back-end sur 5118). Penser alors à `VITE_API_URL`.
- CORS : autorise `http://localhost:5173` (`ALLOWED_ORIGIN` pour changer).
- Routes : `GET /api/menu?lang=fr|ar`, `GET /api/restaurant` (`ouvertMaintenant` calculé en
  heure de Tunis). Les images sont celles de `public/images/`.
- Cas de test : `/api/menu?fail=1` (500), `?empty=1` (menu vide), `?delay=800` (latence)
  s'ajoutent à l'URL appelée par le front (à tester dans le navigateur ou avec curl).
- Données : `fixtures/menu.json` (7 catégories, 24 plats, 1 indisponible, 6 populaires, 2 plats
  dont l'image lourde est volontairement remplacée par `default.svg`, 3 sans image) et
  `fixtures/restaurant.json` (dimanche fermé, samedi jusqu'à 02:00 donc « après minuit »).
