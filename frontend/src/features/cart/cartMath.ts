import type { Panier, PanierLigne } from '@/lib/types'

/** Plafond serveur par ligne (PanierRules.MaxQuantite). */
export const MAX_QUANTITY = 20

export const EMPTY_CART: Panier = {
  lignes: [],
  nombreArticles: 0,
  sousTotal: 0,
  dateMiseAJour: null,
}

export interface CartArticleSnapshot {
  id: number
  nom: string
  prix: number
  imageUrl: string | null
  disponible: boolean
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Les fonctions ci-dessous ne servent qu'à l'AFFICHAGE OPTIMISTE entre le clic et la réponse du
 * serveur. Dès que la réponse arrive, ses valeurs (sous-total, totaux de ligne) remplacent celles-ci.
 */
function withTotals(lignes: PanierLigne[], previous: Panier): Panier {
  return {
    ...previous,
    lignes,
    nombreArticles: lignes.reduce((n, l) => n + l.quantite, 0),
    sousTotal: round2(lignes.reduce((n, l) => n + l.totalLigne, 0)),
  }
}

const line = (base: PanierLigne, quantite: number): PanierLigne => ({
  ...base,
  quantite,
  totalLigne: round2(base.prixUnitaire * quantite),
})

export const capQuantity = (n: number) => Math.min(Math.max(Math.trunc(n), 1), MAX_QUANTITY)

/** Ajoute en cumulant, plafonné à 20 (comme PanierRules.AddCapped). */
export function applyAdd(cart: Panier, article: CartArticleSnapshot, quantite = 1): Panier {
  const existing = cart.lignes.find((l) => l.articleId === article.id)
  if (existing) {
    const next = Math.min(existing.quantite + quantite, MAX_QUANTITY)
    return withTotals(
      cart.lignes.map((l) => (l.articleId === article.id ? line(l, next) : l)),
      cart,
    )
  }
  const created = line(
    {
      articleId: article.id,
      nom: article.nom,
      prixUnitaire: article.prix,
      imageUrl: article.imageUrl,
      disponible: article.disponible,
      quantite: 0,
      totalLigne: 0,
      avertissement: null,
    },
    Math.min(quantite, MAX_QUANTITY),
  )
  return withTotals([...cart.lignes, created], cart)
}

export function applySetQuantity(cart: Panier, articleId: number, quantite: number): Panier {
  const next = capQuantity(quantite)
  return withTotals(
    cart.lignes.map((l) => (l.articleId === articleId ? line(l, next) : l)),
    cart,
  )
}

export function applyRemove(cart: Panier, articleId: number): Panier {
  return withTotals(
    cart.lignes.filter((l) => l.articleId !== articleId),
    cart,
  )
}

export const applyClear = (cart: Panier): Panier => ({
  ...EMPTY_CART,
  dateMiseAJour: cart.dateMiseAJour,
})

/** Une ligne bloque la commande si l'API l'a signalée ou si l'article n'est plus disponible. */
export const isBlockedLine = (l: PanierLigne) => l.avertissement !== null || !l.disponible

export const blockedLines = (cart: Panier | undefined) => cart?.lignes.filter(isBlockedLine) ?? []

/** Quantité actuellement dans le panier pour un article (0 si absent). */
export const quantityOf = (cart: Panier | undefined, articleId: number) =>
  cart?.lignes.find((l) => l.articleId === articleId)?.quantite ?? 0
