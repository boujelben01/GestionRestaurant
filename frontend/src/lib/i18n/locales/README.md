# Fichiers de traduction

- `fr.json` : référence. Toute nouvelle clé s'ajoute d'abord ici.
- `ar.json` : arabe tunisien naturel pour l'interface (boutons, messages, aides), arabe correct
  (fusha simple) pour les titres de pages. **À faire relire par un locuteur tunisien avant mise
  en production** : la traduction a été rédigée sans relecture native.

Les deux fichiers doivent garder exactement la même arborescence de clés. JSON n'autorise pas les
commentaires : les notes vivent ici.

## Pluriels

i18next v26 utilise `Intl.PluralRules` : le français a `_one` / `_other`, l'arabe a six formes
(`_zero`, `_one`, `_two`, `_few`, `_many`, `_other`). Les clés comptées (`a11y.cartCount`, `cart.itemCount`, `menu.resultCount`) ont les six formes en arabe.

## Clés les plus incertaines (priorité de relecture)

| Clé                                                                                                      | Remarque                                                                                                                   |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `brand.name`, `brand.tagline`                                                                            | « ريستو » est un nom provisoire ; « بنّة » (délicieux) à confirmer.                                                        |
| `menu.addToCart` (« زيد للسلة »), `cart.continue` (« كمّل الطلب »)                                       | Formules imposées par le cahier des charges, à valider en contexte.                                                        |
| `a11y.cartUnavailable`                                                                                   | Pas de forme plurielle arabe ; formulation « موش متوفرة توّا ».                                                            |
| `a11y.switchToLang`                                                                                      | Construction « بـ{{language}} » avec un nom de langue en français : à tester.                                              |
| `order.success` (« يعطيك الصحة »)                                                                        | Registre familier : à confirmer.                                                                                           |
| `order.status.*`, `order.type.*`                                                                         | Termes d'usage restaurant (« للأخذ », « في المطعم ») à valider.                                                            |
| `auth.errors.locked`                                                                                     | « برشا محاولات » : à confirmer.                                                                                            |
| `home.why*`, `home.subtitle`                                                                             | Ton publicitaire, mélange fusha/dialecte à homogénéiser.                                                                   |
| `errors.notFound.text` (« يا الله نرجعو للطريق »)                                                        | Expression imagée, ajustable.                                                                                              |
| `restaurant.closed` / `restaurant.closedNow`                                                             | « مسكّر » (dialecte) vs « مغلق » (fusha).                                                                                  |
| `common.yes`                                                                                             | « إي » (dialecte) ; « نعم » en fusha.                                                                                      |
| `menu.resultCount_*`                                                                                     | Six formes plurielles arabes écrites à la main (« طبقين », « {{count}} أطباق »…) : à valider.                              |
| `menu.add` (« زيد »), `menu.addAria`, `menu.signInToOrder`                                               | Libellés courts du bouton Ajouter et de son infobulle.                                                                     |
| `menu.search*` (« قلّب على طبق »), `menu.noResults*`, `menu.resetFilters` (« رجّع من الأول »)            | Registre familier à confirmer.                                                                                             |
| `home.story.*`, `home.why*`                                                                              | **Textes génériques à remplacer** par l'histoire réelle du restaurant (aucun fait précis volontairement).                  |
| `home.cta.title` (« جيعان شوية؟ »), `home.info.title` (« عدّي علينا »)                                   | Tournures très orales.                                                                                                     |
| `home.reserve`, `home.reserveSoon`                                                                       | « احجز » : à confirmer.                                                                                                    |
| `restaurant.afterMidnight` (« يسكّر بعد نصف الليل »)                                                     | Mention affichée pour une fermeture après minuit.                                                                          |
| `contact.form.*` (« اكتبلنا », « ابعث »), `contact.mapLink`                                              | Formulaire inactif pour l'instant.                                                                                         |
| `a11y.cartCount_*`, `cart.itemCount_*`                                                                   | Six formes plurielles arabes (« منتجين », « {{count}} منتجات », « {{count}} منتج ») ; « منتج » pour « article » à valider. |
| `cart.added` (« تزادت {{name}} للسلة »), `cart.view` (« شوف السلة »)                                     | Accord du verbe avec le nom du plat (féminin/masculin) non géré : formulation à rendre neutre si besoin.                   |
| `cart.checkout` (« كمّل الطلب »), `checkout.confirm` (« أكّد الطلب »)                                    | Boutons principaux du parcours.                                                                                            |
| `cart.warningInactive`, `cart.warningUnavailable`, `cart.blockedReason`, `cart.closedBanner`             | Messages d'erreur du panier, ton à vérifier.                                                                               |
| `checkout.typeDesc.*` (« لين تحب », « يجيك للطاولة »)                                                    | Descriptions courtes des types de commande, très orales.                                                                   |
| `checkout.failure.*`, `checkout.blocker.*`, `checkout.errors.*`                                          | Messages d'échec de commande (fermé, minimum, indisponible).                                                               |
| `checkout.cash` (« كاش عند الاستلام »)                                                                   | Seule option de paiement.                                                                                                  |
| `confirmation.heading` (« يعطيك الصحة، طلبك تبعث! »)                                                     | Registre familier ; « تبعث » (envoyé) à confirmer.                                                                         |
| `table.*` (« إنت في الطاولة », « اخرج من الطاولة », « سكّاني »)                                          | Vocabulaire de la table/QR (« سكّاني » = scannez) à valider.                                                               |
| `menu.unavailableHint`                                                                                   | Texte d'infobulle distinct du badge « Indisponible » (évite un doublon dans le DOM).                                       |
| `orders.loaded_*`, `orders.loadMore` (« زيد حمّل »)                                                      | Six formes plurielles arabes avec « من {{total}} » ; verbe « حمّل » à valider.                                             |
| `orderDetail.cancelConflict` (« تاخذ في التحضير من قبل »)                                                | Message du 409 d'annulation.                                                                                               |
| `orderDetail.payOnReceipt` (« يتخلّص عند الاستلام »), `orderDetail.paid`                                 | Vocabulaire du paiement.                                                                                                   |
| `orderDetail.reason.*`, `orderDetail.added`, `orderDetail.skipped`                                       | Raisons du résumé « Commander à nouveau ».                                                                                 |
| `orderDetail.autoUpdate` (« تحديث أوتوماتيكي »)                                                          | Indicateur de polling.                                                                                                     |
| `profile.*` (« ملفّي الشخصي », « بدّل كلمة السر », « كلمتين السر موش كيف كيف »)                          | Libellés du profil et du changement de mot de passe.                                                                       |
| `order.status.*` (« في الانتظار », « ملغاة »…)                                                           | Statuts : mélange fusha/dialecte à homogénéiser.                                                                           |
| `admin.*` (tout l'espace d'administration)                                                               | Arabe volontairement sobre et fonctionnel ; à relire dans son ensemble par un locuteur tunisien.                           |
| `admin.orders.action.*` (« حضّر », « جاهز », « مكتمل »)                                                  | Libellés des boutons de transition en cuisine.                                                                             |
| `admin.orders.paid` / `unpaid` / `markPaid` (« باش يتخلّص », « علّم كمخلّص »)                            | Vocabulaire d'encaissement.                                                                                                |
| `admin.orders.newCount_*`, `newAnnounce_*`, `today_*`, `results_*`, `pendingCount_*`, `activeArticles_*` | Six formes plurielles arabes écrites à la main.                                                                            |
| `admin.orders.errors.conflict`                                                                           | Message du 409 de changement de statut.                                                                                    |
| `admin.menu.category.deactivateConflict`                                                                 | 409 : catégorie avec articles actifs.                                                                                      |
| `admin.menu.article.soldOut` (« خلص »)                                                                   | « Épuisé » en dialecte.                                                                                                    |
| `admin.users.selfExplain` (« ما تنجمش توقّف حسابك إنت »)                                                 | Explication sur la ligne de l'administrateur connecté.                                                                     |

## Conventions

- Groupes stables : `nav.*`, `a11y.*`, `common.*`, `auth.*`, `validation.*`, `errors.*`,
  `footer.*`, `restaurant.*`, `menu.*`, `cart.*`, `order.*`, `contact.*`, `home.*`, `seo.*`.
- Interpolation `{{name}}` : ne jamais concaténer des fragments traduits.
- Les clés `validation.*` sont consommées par `src/features/auth/validation.ts`.
