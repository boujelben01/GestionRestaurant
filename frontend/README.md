# Resto — frontend

Site public du restaurant (français et arabe tunisien, RTL). Vite + React 18 + TypeScript strict,
React Router, axios, TanStack Query, i18next, Tailwind CSS v4, motion.

## Prérequis

- Node.js 20 ou plus (développé avec Node 24) et npm.
- L'API ASP.NET Core (`backend/`) sur http://localhost:5118. Son CORS autorise
  `http://localhost:5173`, le port imposé au serveur de dev (`strictPort`).

## Variables d'environnement

| Variable       | Rôle                                                                           |
| -------------- | ------------------------------------------------------------------------------ |
| `VITE_API_URL` | URL de base de l'API (ex. `http://localhost:5118`). Lue dans `src/lib/api.ts`. |

```powershell
cd frontend
copy .env.example .env   # puis ajuster si besoin ; .env est ignoré par git
npm install
npm run dev              # http://localhost:5173
```

Aucun secret n'est stocké côté front : tout ce qui est dans `VITE_*` est public dans le bundle.

## Scripts

| Script             | Action                                                   |
| ------------------ | -------------------------------------------------------- |
| `npm run dev`      | Serveur de développement (port 5173)                     |
| `npm run build`    | Vérification TypeScript puis build de production         |
| `npm run preview`  | Sert le build localement                                 |
| `npm run lint`     | ESLint, 0 warning toléré                                 |
| `npm run format`   | Prettier (avec tri des classes Tailwind)                 |
| `npm test`         | Vitest + React Testing Library (une passe)               |
| `npm run mock:api` | API factice (voir `dev-mocks/README.md`), jamais en prod |

## Structure

```
src/
  app/          providers, routeur (code splitting par route), racine
  features/     auth, menu, restaurant : logique et composants métier
  components/   ui (design system), layout (header, footer, menu mobile), Seo
  pages/        une page par route (chargées en lazy)
  lib/          api (axios), errors (AppError), format, tokenStore, queryClient, i18n/
  styles/       index.css : tokens Tailwind (@theme), polices, base
  test/         setup Vitest et adaptateur HTTP factice
dev-mocks/      serveur et fixtures de développement, hors du bundle
```

Alias : `@` pointe vers `src`.

## API et erreurs

`src/lib/api.ts` ajoute le Bearer à chaque requête. Un 401 reçu alors qu'un jeton était envoyé
termine la session (jeton effacé, caches privés vidés, redirection vers `/connexion` avec un
toast). Les erreurs RFC 7807 deviennent des `AppError` (`status`, `fieldErrors` par champ en
camelCase, `isNetwork`). TanStack Query ne relance pas les 4xx (2 essais max sinon).

## Authentification : choix et limite

Le jeton JWT et son expiration sont conservés dans **localStorage** (`resto.token`), afin de
survivre au rechargement sans cookie ni changement du backend. **Limite** : tout script exécuté
dans la page (faille XSS, dépendance compromise) peut lire ce jeton. Atténuations : React échappe
le HTML, aucun `dangerouslySetInnerHTML`, durée de vie courte du jeton (60 min par défaut),
expiration vérifiée côté client et compte désactivé refusé côté serveur. Pour un niveau supérieur,
passer à un cookie `HttpOnly` + `SameSite` émis par l'API (changement backend à prévoir) et ajouter
une Content-Security-Policy.

`AuthContext` expose `login`, `register` (crée le compte puis ouvre la session), `logout`,
`user`, `hasRole` ; le profil est rechargé au démarrage via `/api/auth/me`. Routes protégées :
`<RequireAuth>` et `<RequireRole role="Admin">` (`features/auth/guards.tsx`).

## Internationalisation

- Langues : `fr` (référence) et `ar` (RTL). Détection : localStorage (`resto.lang`) puis navigateur.
- `<html lang dir>` est mis à jour à chaque changement ; la langue est envoyée à l'API (`?lang=`)
  et fait partie des clés de requête du menu.
- Prix : `formatPrice(montant, lang)` (`Intl.NumberFormat`, TND, 2 décimales).
- **Ajouter une langue** : créer `src/lib/i18n/locales/<code>.json` (mêmes clés que `fr.json`),
  l'enregistrer dans `src/lib/i18n/index.ts` (`resources`, `SUPPORTED_LANGS`, `dirOf`), ajouter
  le bouton dans `LanguageSwitcher`, la locale dans `lib/format.ts` et le type `Lang`. Le backend
  ne gère que `fr` et `ar`.
- **Relire les traductions** : `ar.json` n'a pas été relu par un locuteur tunisien. La liste des
  clés les plus incertaines est dans `src/lib/i18n/locales/README.md`. Un test vérifie que
  `fr.json` et `ar.json` ont les mêmes clés.
- Textes d'ambiance de l'accueil (`home.story.*`, `home.why*`) : génériques, à remplacer.

## Design system

Tous les tokens sont dans `src/styles/index.css` (`@theme`) et deviennent des utilitaires
Tailwind (`bg-sand-50`, `text-terracotta-700`, `rounded-lg`, `shadow-lift`...).

- Couleurs : `sand` (fonds crème), `ink` (texte), `terracotta` (actions), `sidi` (bleu Sidi Bou
  Saïd), `olive`, `gold` (accent rare), `danger`. Les ratios de contraste AA des combinaisons
  utilisées sont notés en commentaire dans le CSS.
- Polices (via `@fontsource`, sans CDN) : Fraunces (titres), Inter (texte), Cairo (arabe, bascule
  automatique sous `[dir=rtl]`).
- Motifs : zellige en SVG (`ZelligePattern`, `ZelligeDivider`), à utiliser avec parcimonie.
- Mouvement : transform et opacité uniquement ; `MotionConfig reducedMotion="user"` et règle CSS
  `prefers-reduced-motion`.
- RTL : utilitaires logiques uniquement (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`,
  `text-start`) ; icônes directionnelles avec `rtl:-scale-x-100`.

Composants (`src/components/ui`, import depuis `@/components/ui`) : `Button` (variantes, tailles,
`loading`, rend un lien avec `to`/`href`), `Card`, `Badge`, `Skeleton`, `Dialog`, `Toast`
(`ToastProvider` + `useToast`), `Field`/`Input`, `Tooltip`, `ErrorState`, `EmptyState`,
`Reveal`, `PageTransition`, `Logo`, `ZelligePattern`.

## Images

`public/images/` contient les photos du catalogue. `chawarma.jpg` et `assiette-chawarma.jpg`
(6-7 Mo) sont volontairement remplacées par `default.svg` (`features/menu/images.ts`) tant
qu'elles ne sont pas compressées : exporter en WebP, 1200 px de large maximum, puis retirer leur
nom de la liste `HEAVY_IMAGES`.

## Tests

`npm test` couvre : AuthContext (login, 401, expiration, rechargement du profil), erreurs
ProblemDetails, formatage des prix et horaires, bascule de langue et `dir`, carte d'article
(indisponible, populaire, repli d'image), filtre du menu. Les appels HTTP sont simulés par un
adaptateur axios en mémoire (`src/test/mockApi.ts`), jamais par le vrai backend.
