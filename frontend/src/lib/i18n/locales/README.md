# Fichiers de traduction

- `fr.json` : référence. Toute nouvelle clé s'ajoute d'abord ici.
- `ar.json` : arabe tunisien naturel pour l'interface (boutons, messages, aides), arabe correct
  (fusha simple) pour les titres de pages. **À faire relire par un locuteur tunisien avant mise
  en production** : la traduction a été rédigée sans relecture native.

Les deux fichiers doivent garder exactement la même arborescence de clés. JSON n'autorise pas les
commentaires : les notes vivent ici.

## Pluriels

i18next v26 utilise `Intl.PluralRules` : le français a `_one` / `_other`, l'arabe a six formes
(`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`). Pour l'instant seule la clé
`a11y.cartUnavailable` est plurielle (en français uniquement ; l'arabe retombe sur la forme
sans suffixe, volontairement neutre). Ajouter les formes arabes si des libellés comptés
apparaissent (« 3 articles » en arabe : `_few`).

## Clés les plus incertaines (priorité de relecture)

| Clé                                                                                           | Remarque                                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `brand.name`, `brand.tagline`                                                                 | « ريستو » est un nom provisoire ; « بنّة » (délicieux) à confirmer.                                       |
| `menu.addToCart` (« زيد للسلة »), `cart.continue` (« كمّل الطلب »)                            | Formules imposées par le cahier des charges, à valider en contexte.                                       |
| `a11y.cartUnavailable`                                                                        | Pas de forme plurielle arabe ; formulation « موش متوفرة توّا ».                                           |
| `a11y.switchToLang`                                                                           | Construction « بـ{{language}} » avec un nom de langue en français : à tester.                             |
| `order.success` (« يعطيك الصحة »)                                                             | Registre familier : à confirmer.                                                                          |
| `order.status.*`, `order.type.*`                                                              | Termes d'usage restaurant (« للأخذ », « في المطعم ») à valider.                                           |
| `auth.errors.locked`                                                                          | « برشا محاولات » : à confirmer.                                                                           |
| `home.why*`, `home.subtitle`                                                                  | Ton publicitaire, mélange fusha/dialecte à homogénéiser.                                                  |
| `errors.notFound.text` (« يا الله نرجعو للطريق »)                                             | Expression imagée, ajustable.                                                                             |
| `restaurant.closed` / `restaurant.closedNow`                                                  | « مسكّر » (dialecte) vs « مغلق » (fusha).                                                                 |
| `common.yes`                                                                                  | « إي » (dialecte) ; « نعم » en fusha.                                                                     |
| `menu.resultCount_*`                                                                          | Six formes plurielles arabes écrites à la main (« طبقين », « {{count}} أطباق »…) : à valider.             |
| `menu.add` (« زيد »), `menu.addAria`, `menu.signInToOrder`                                    | Libellés courts du bouton Ajouter et de son infobulle.                                                    |
| `menu.search*` (« قلّب على طبق »), `menu.noResults*`, `menu.resetFilters` (« رجّع من الأول ») | Registre familier à confirmer.                                                                            |
| `home.story.*`, `home.why*`                                                                   | **Textes génériques à remplacer** par l'histoire réelle du restaurant (aucun fait précis volontairement). |
| `home.cta.title` (« جيعان شوية؟ »), `home.info.title` (« عدّي علينا »)                        | Tournures très orales.                                                                                    |
| `home.reserve`, `home.reserveSoon`                                                            | « احجز » : à confirmer.                                                                                   |
| `restaurant.afterMidnight` (« يسكّر بعد نصف الليل »)                                          | Mention affichée pour une fermeture après minuit.                                                         |
| `contact.form.*` (« اكتبلنا », « ابعث »), `contact.mapLink`                                   | Formulaire inactif pour l'instant.                                                                        |

## Conventions

- Groupes stables : `nav.*`, `a11y.*`, `common.*`, `auth.*`, `validation.*`, `errors.*`,
  `footer.*`, `restaurant.*`, `menu.*`, `cart.*`, `order.*`, `contact.*`, `home.*`, `seo.*`.
- Interpolation `{{name}}` : ne jamais concaténer des fragments traduits.
- Les clés `validation.*` sont consommées par `src/features/auth/validation.ts`.
