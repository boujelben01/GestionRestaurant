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

`VITE_PUBLIC_URL` (voir « Salle et QR codes ») est l'adresse encodée dans les QR des tables.

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

## Routes

| Route                          | Accès    | Rôle                                     |
| ------------------------------ | -------- | ---------------------------------------- |
| `/`, `/menu`, `/contact`       | public   | Pages publiques                          |
| `/connexion`, `/inscription`   | public   | Authentification                         |
| `/table/:code`                 | public   | Entrée par QR de table (voir ci-dessous) |
| `/panier`                      | connecté | Panier                                   |
| `/commande`                    | connecté | Formulaire de commande                   |
| `/commande/:id/confirmation`   | connecté | Confirmation après création              |
| `/commandes`, `/commandes/:id` | connecté | Historique et suivi                      |
| `/profil`                      | connecté | Profil et mot de passe                   |

Les invités ne peuvent pas commander (décision du back-end). Un invité qui clique sur « Ajouter »
est envoyé sur `/connexion` avec `state.from` (chemin + query) et revient à la page d'origine après
connexion ; il en va de même pour toute route protégée ou après un 401.

## Panier et commande

- **Panier** (`features/cart`) : requêtes TanStack Query sous la clé `['private','cart',lang]`
  (vidée à la déconnexion). Les mutations (ajout, quantité, suppression, vider) sont **optimistes**
  avec retour arrière en cas d'erreur, puis le cache est remplacé par la réponse du serveur. Les
  montants affichés sont ceux du serveur ; le client ne calcule que l'aperçu optimiste et l'aperçu
  des frais de livraison. Plafond 20 par ligne. Un double clic sur « Ajouter » pour un même article
  en vol est ignoré. Une ligne `inactif` / `indisponible` bloque la commande.
- **Formulaire** (`features/orders/checkout.ts`) : type (À emporter, Livraison, Sur place),
  téléphone, note, adresse (10 à 500 caractères, livraison seulement), code de table (sur place
  seulement). `buildOrderRequest` n'envoie que les champs applicables au type, jamais `userId` ni
  `panierId`. Frais et minimum de livraison viennent de `/api/restaurant` ; sous le minimum, le bouton
  est bloqué. Paiement : espèces à la réception (seule option).
- **Erreurs de `POST /api/commandes`** : le back-end ne renvoie que du texte (pas de code d'erreur)
  et réutilise un même statut pour plusieurs cas (400 panier vide / minimum, 409 fermé /
  indisponible). Le front relit donc le panier et `/api/restaurant` après l'échec pour classer
  l'erreur (`empty`, `minimum`, `closed`, `unavailable`, `fields`, `network`, `server`) au lieu de
  lire le message français. Anti-doublon : bouton désactivé pendant l'envoi (le serveur sérialise
  aussi les créations concurrentes).
- **QR de table** : le QR d'une table encode `<site>/table/<code>` (le code est le GUID de la table).
  `/table/:code` appelle `GET /api/tables/{code}`, mémorise `{code, numero}` dans `sessionStorage`
  (visite en cours seulement), affiche le bandeau « Vous êtes à la table N » et ouvre `/menu`.
  « Sur place » n'est proposé que si une table est mémorisée. Un code refusé par l'API la fait oublier.

## Suivi, historique et profil

- **Mes commandes** : liste paginée « Charger plus » (10 par page), plus récentes d'abord.
- **Détail** : frise de statuts construite depuis `historique` (EnAttente → EnPreparation → Prete →
  Terminee, variante Annulee), dates en fuseau Africa/Tunis. **Polling** : `useOrder` relit la
  commande toutes les 15 s tant que le statut n'est ni `Terminee` ni `Annulee` ; react-query le
  suspend quand l'onglet est masqué. Annulation possible seulement en `EnAttente` (409 = la commande
  a déjà été prise en charge, le détail est rechargé). « Commander à nouveau » ajoute au panier les
  lignes dont l'article existe encore et est disponible, aux prix actuels, et résume le reste.
- **Profil** : nom, téléphone, langue favorite (`PUT /api/auth/me`), changement de mot de passe,
  déconnexion. La langue favorite s'applique à la connexion seulement si l'utilisateur n'a jamais
  choisi de langue lui-même : la langue détectée n'est plus mémorisée, seul un clic sur le
  sélecteur écrit `resto.lang`.

## Administration (`/admin`)

Protégée par `<RequireRole role="Admin" forbidden={<Forbidden/>}>` : un invité est envoyé sur `/connexion` (retour mémorisé), un client connecté voit une page 403 claire, et aucune requête `/api/admin/*` n'est émise pour lui. Le back-end reste l'autorité (403 sur chaque route). L'admin a son propre layout (navigation latérale, tiroir en mobile, lien « Voir le site »), est `noindex` et chargé à la demande. Un lien « Administration » apparaît dans le menu utilisateur des seuls admins.

- **Commandes** (`/admin/commandes`) : colonnes `EnAttente` / `EnPreparation` / `Prete` (onglets en mobile) alimentées par `GET /api/admin/commandes/actives` et les compteurs du jour. **Polling toutes les 10 s**, suspendu quand l'onglet est masqué et relancé au retour. Les boutons ne proposent que les transitions valides (miroir de `StatutTransitions`) et envoient la `version` ; la carte change de colonne de façon **optimiste** avec retour arrière, et un 409 (transition interdite ou commande modifiée entre-temps) affiche un toast puis recharge l'écran. L'historique (filtres statut, type, paiement, dates, recherche) passe par `GET /api/admin/commandes`. Une carte devient rouge (avec le libellé « En retard ») au-delà de 5 min en attente, 20 min en préparation, 10 min prête, mesurées depuis la dernière mise à jour.
- **Contrat à connaître** : `GET /actives` ne renvoie ni téléphone, ni total, ni état de paiement, ni adresse. Le front charge donc le détail de chaque commande active (clé de cache incluant `version` : un seul chargement par version).
- **Alerte sonore** : à chaque **nouvelle** commande `EnAttente`, détectée en comparant les identifiants entre deux relevés (jamais au premier chargement, jamais deux fois pour la même), le front joue un carillon généré par Web Audio (aucun fichier), annonce « Nouvelle commande CMD-xxx » dans une zone `aria-live`, affiche une pastille et préfixe le titre de l'onglet : `(3) Commandes`. Le bouton Son active ou coupe l'alerte (mémorisé dans `localStorage`, clé `resto.admin.sound`). **Les navigateurs interdisent le son tant que l'utilisateur n'a pas cliqué sur la page** : tant que ce n'est pas fait, un bouton « Cliquez ici pour autoriser le son » est affiché ; le clic sur « Son » sert aussi d'autorisation. L'alerte n'est active que sur l'écran Commandes.
- **Menu** (`/admin/menu`) : catégories (création, modification, activer/désactiver, 409 si articles actifs, réordonnancement par boutons Monter/Descendre au clavier) et articles (filtres, bascule rapide « disponible » et « actif » optimiste, formulaire FR/AR avec prix à 2 décimales max, ImageUrl validée comme `ImageUrlRules` du back-end avec aperçu, erreurs serveur par champ). Aucune suppression : « désactiver ». Le réordonnancement d'articles exige un filtre de catégorie seul (50 articles max).
- **Restaurant** (`/admin/restaurant`) : paramètres, horaires des 7 jours (« ferme après minuit » signalé), interrupteur « Prendre des commandes » avec confirmation à la fermeture.
- **Utilisateurs** (`/admin/utilisateurs`) : liste paginée avec recherche, activer/désactiver ; le bouton est désactivé, avec explication, sur son propre compte (le back-end répond 400 sinon).

Les écrans admin n'ont jamais été testés contre la vraie API, seulement contre le mock (`dev-mocks/`) et des tests automatisés.

## Salle et QR codes (`/admin/tables`)

Deux onglets, mémorisés dans l'URL (`?vue=salle` par défaut, `?vue=gestion`).

- **Salle** : une carte par table avec un badge d'état (**Libre**, **Occupée**, **À encaisser**, **Inactive**, toujours avec un libellé texte en plus de la couleur), le total à encaisser, la durée d'occupation et les commandes sur place à suivre. L'état est **calculé par le serveur** à partir des commandes (`GET /api/admin/tables/salle`, relevé toutes les 10 s, suspendu onglet masqué) ; le front ne fait qu'un aperçu optimiste. « Encaisser » demande confirmation en affichant le montant, « Libérer » explique ce qui bloque (commandes en cours, commandes non encaissées) et laisse toujours le serveur trancher : un 409 est affiché tel quel dans le dialogue, jamais d'échec silencieux.
- **Gestion** : ajout (numéro facultatif = automatique), modification, activation / désactivation (confirmation), régénération du code (avertissement), QR par table, « Copier le lien », impression.
- **QR codes** : générés dans le navigateur (paquet `qrcode`, aucun service externe), en SVG noir sur blanc. Un QR encode `${VITE_PUBLIC_URL}/table/<code>` (slash final toléré) ; l'URL complète est affichée sous chaque QR. Si l'adresse contient « localhost » (ou une adresse de boucle locale), un avertissement visible demande de la remplacer avant impression.
- **Impression** : « Imprimer toutes les tables » imprime une fiche par table **active** (nom du restaurant, « Table N », QR grand, « Scannez pour commander » en français et en arabe) ; « Imprimer » d'une carte n'imprime que cette table (impossible pour une table inactive). La feuille est un bloc `data-print-sheet` rendu dans `<body>`, visible uniquement en `@media print` ; tout le reste de la page est masqué à l'impression. L'aperçu est la boîte de dialogue d'impression du navigateur.

**Imprimer APRÈS le déploiement.** Le QR contient l'adresse du site telle que configurée au moment de l'affichage : fixer `VITE_PUBLIC_URL` sur l'adresse définitive, reconstruire le front, puis seulement imprimer. Un QR imprimé avec `localhost` ne marchera pour personne. **Régénérer le code d'une table invalide immédiatement ses QR déjà imprimés** (le back-end répond 404) : à n'utiliser que pour remplacer un QR compromis.

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

`npm test` couvre : tables et QR (URL du QR, avertissement localhost, ajout, doublon, désactivation et régénération avec confirmation, impression des seules tables actives), plan de salle (états, encaisser, libérer, 409), administration (garde de rôle, transitions, nouvelles commandes, son, optimiste + 409, validation du formulaire d'article, auto-désactivation), parcours complets (invité → connexion → retour, formulaire de commande par type, annulation, 409, « Commander à nouveau », profil), AuthContext (login, 401, expiration, rechargement du profil), erreurs
ProblemDetails, formatage des prix et horaires, bascule de langue et `dir`, carte d'article
(indisponible, populaire, repli d'image), filtre du menu. Les appels HTTP sont simulés par un
adaptateur axios en mémoire (`src/test/mockApi.ts`), jamais par le vrai backend.
