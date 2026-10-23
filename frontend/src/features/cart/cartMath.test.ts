import { describe, expect, it } from 'vitest'
import type { Panier, PanierLigne } from '@/lib/types'
import {
  EMPTY_CART,
  MAX_QUANTITY,
  applyAdd,
  applyClear,
  applyRemove,
  applySetQuantity,
  blockedLines,
  quantityOf,
} from './cartMath'

const article = { id: 1, nom: 'Brik', prix: 4.5, imageUrl: null, disponible: true }

const ligne = (over: Partial<PanierLigne> = {}): PanierLigne => ({
  articleId: 1,
  nom: 'Brik',
  prixUnitaire: 4.5,
  imageUrl: null,
  disponible: true,
  quantite: 2,
  totalLigne: 9,
  avertissement: null,
  ...over,
})

const cart = (lignes: PanierLigne[]): Panier => ({
  lignes,
  nombreArticles: lignes.reduce((n, l) => n + l.quantite, 0),
  sousTotal: lignes.reduce((n, l) => n + l.totalLigne, 0),
  dateMiseAJour: null,
})

describe('cartMath', () => {
  it("ajoute un nouvel article et recalcule les totaux d'aperçu", () => {
    const next = applyAdd(EMPTY_CART, article)
    expect(next.lignes).toHaveLength(1)
    expect(next.nombreArticles).toBe(1)
    expect(next.sousTotal).toBe(4.5)
  })

  it("cumule la quantité d'un article déjà présent", () => {
    const next = applyAdd(cart([ligne()]), article, 3)
    expect(next.lignes[0]?.quantite).toBe(5)
    expect(next.sousTotal).toBe(22.5)
  })

  it('plafonne à 20 (comme le serveur)', () => {
    const next = applyAdd(cart([ligne({ quantite: 19, totalLigne: 85.5 })]), article, 5)
    expect(next.lignes[0]?.quantite).toBe(MAX_QUANTITY)
    expect(next.nombreArticles).toBe(20)
  })

  it('fixe la quantité dans les bornes 1..20', () => {
    expect(applySetQuantity(cart([ligne()]), 1, 50).lignes[0]?.quantite).toBe(20)
    expect(applySetQuantity(cart([ligne()]), 1, 0).lignes[0]?.quantite).toBe(1)
  })

  it('retire une ligne et vide le panier', () => {
    expect(applyRemove(cart([ligne()]), 1).lignes).toEqual([])
    expect(applyClear(cart([ligne()])).nombreArticles).toBe(0)
  })

  it('arrondit les montants à deux décimales', () => {
    const next = applyAdd(EMPTY_CART, { ...article, prix: 3.333 }, 3)
    expect(next.sousTotal).toBe(10)
  })

  it('repère les lignes bloquantes (avertissement ou indisponible)', () => {
    const c = cart([
      ligne(),
      ligne({ articleId: 2, avertissement: 'indisponible' }),
      ligne({ articleId: 3, disponible: false }),
    ])
    expect(blockedLines(c).map((l) => l.articleId)).toEqual([2, 3])
    expect(blockedLines(undefined)).toEqual([])
  })

  it('quantityOf', () => {
    expect(quantityOf(cart([ligne()]), 1)).toBe(2)
    expect(quantityOf(cart([ligne()]), 9)).toBe(0)
    expect(quantityOf(undefined, 1)).toBe(0)
  })
})
