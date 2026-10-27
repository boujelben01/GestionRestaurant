# El Resto : site

Site public et espace d'administration d'El Resto, en français.
Vite, React 18, TypeScript strict, React Router, TanStack Query, axios, Tailwind CSS v4, motion.

## Prérequis

- Node.js et npm (le build de production utilise Node 24, voir `render.yaml`).
- L'API (`backend/`) sur http://localhost:5118 ; son CORS autorise `http://localhost:5173`,
  le port imposé au serveur de développement (`strictPort`).

```powershell
cd frontend
copy .env.example .env   # puis ajuster ; .env est ignoré par git
npm install
npm run dev              # http://localhost:5173
```

## Variables d'environnement

| Variable | Rôle |
| --- | --- |
| `VITE_API_URL` | Adresse de base de l'API, lue dans `src/lib/api.ts` |
| `VITE_PUBLIC_URL` | Adresse publique du site, encodée dans les QR codes des tables (`src/features/admin/tables/qr.ts`) |

Les variables `VITE_*` sont intégrées au build et donc publiques : aucun secret ici.
Fixer `VITE_PUBLIC_URL` sur l'adresse définitive avant d'imprimer les QR codes
(l'écran des tables affiche un avertissement tant qu'elle contient `localhost`).

## Scripts

| Script | Action |
| --- | --- |
| `npm run dev` | Serveur de développement (port 5173) |
| `npm run build` | Vérification TypeScript puis build de production (`dist/`) |
| `npm run preview` | Sert le build localement |
| `npm test` | Tests Vitest + React Testing Library (une passe) |
| `npm run test:watch` | Tests en mode surveillance |

## Structure de `src/`

```
app/          routeur (pages chargées à la demande), providers, tests de parcours complets
pages/        une page par route ; pages/admin pour l'administration
features/     logique métier : menu, panier, commandes, favoris, adresses, profil, auth, admin
components/   ui (composants de base), layout (en-tête, pied de page), admin (mise en page admin)
lib/          client API (axios), erreurs, formatage, stockage du jeton, i18n (fr.json)
styles/       index.css : couleurs, polices et base Tailwind (@theme)
test/         configuration Vitest et API simulée en mémoire (mockApi.ts)
main.tsx      point d'entrée
```

Alias : `@` pointe vers `src`.

## À savoir

- Le jeton de connexion est conservé dans `localStorage` (clé `resto.token`) : simple, mais lisible par
  tout script de la page. Un cookie `HttpOnly` émis par l'API serait plus sûr (changement côté API).
- Les routes `/panier`, `/commande`, `/commandes`, `/favoris` et `/profil` exigent un compte ; `/admin/*`
  exige le rôle Admin (l'API reste l'autorité et répond 403 sinon).
- Les tests simulent l'API (`src/test/mockApi.ts`) et n'appellent jamais le vrai backend.

Documentation de l'API et du déploiement : [docs/TECHNIQUE.md](../docs/TECHNIQUE.md).
