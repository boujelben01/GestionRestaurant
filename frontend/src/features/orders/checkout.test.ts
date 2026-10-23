import { describe, expect, it } from 'vitest'
import { AppError } from '@/lib/errors'
import type { Panier, Restaurant } from '@/lib/types'
import {
  availableTypes,
  buildOrderRequest,
  canSubmit,
  classifyOrderError,
  deliveryInfo,
  previewTotal,
  validateCheckout,
  type CheckoutValues,
} from './checkout'

const base: CheckoutValues = {
  type: 'ARemporter',
  telephone: '+216 20 123 456',
  note: '',
  adresse: '',
  tableCode: null,
}

const restaurant = {
  fraisLivraison: 3,
  montantMinimumLivraison: 20,
  commandesOuvertes: true,
  ouvertMaintenant: true,
} as Restaurant

const cart = (sousTotal: number, over: Partial<Panier['lignes'][number]> = {}): Panier => ({
  lignes: [
    {
      articleId: 1,
      nom: 'Brik',
      prixUnitaire: sousTotal,
      imageUrl: null,
      disponible: true,
      quantite: 1,
      totalLigne: sousTotal,
      avertissement: null,
      ...over,
    },
  ],
  nombreArticles: 1,
  sousTotal,
  dateMiseAJour: null,
})

describe('buildOrderRequest : seuls les champs applicables partent', () => {
  it('à emporter : ni adresse ni table, même si renseignées', () => {
    const req = buildOrderRequest({ ...base, adresse: 'rue ignorée', tableCode: 'abc' })
    expect(req).toEqual({ typeCommande: 'ARemporter', telephone: '+216 20 123 456' })
  })

  it('livraison : adresse (nettoyée), pas de table', () => {
    const req = buildOrderRequest({
      ...base,
      type: 'Livraison',
      adresse: '  12 rue de la Liberté, Tunis ',
      tableCode: 'abc',
      note: ' Sans harissa ',
    })
    expect(req).toEqual({
      typeCommande: 'Livraison',
      telephone: '+216 20 123 456',
      note: 'Sans harissa',
      adresseLivraison: '12 rue de la Liberté, Tunis',
    })
  })

  it("sur place : code de table, pas d'adresse", () => {
    const req = buildOrderRequest({
      ...base,
      type: 'SurPlace',
      adresse: 'x'.repeat(20),
      tableCode: 'guid',
    })
    expect(req).toEqual({
      typeCommande: 'SurPlace',
      telephone: '+216 20 123 456',
      tableCode: 'guid',
    })
  })

  it("n'envoie jamais userId ni panierId", () => {
    const keys = Object.keys(
      buildOrderRequest({ ...base, type: 'Livraison', adresse: 'a'.repeat(12) }),
    )
    expect(keys).not.toContain('userId')
    expect(keys).not.toContain('panierId')
  })
})

describe('validateCheckout', () => {
  it('téléphone obligatoire, valide, 20 caractères max', () => {
    expect(validateCheckout({ ...base, telephone: '' }).telephone).toBe('required')
    expect(validateCheckout({ ...base, telephone: 'abc' }).telephone).toBe('phone')
    expect(validateCheckout({ ...base, telephone: '1'.repeat(21) }).telephone).toBe('phone')
    expect(validateCheckout(base).telephone).toBeUndefined()
  })

  it('note : 500 caractères max', () => {
    expect(validateCheckout({ ...base, note: 'x'.repeat(501) }).note).toBe('tooLong')
    expect(validateCheckout({ ...base, note: 'x'.repeat(500) }).note).toBeUndefined()
  })

  it('livraison : adresse de 10 à 500 caractères', () => {
    const l = { ...base, type: 'Livraison' as const }
    expect(validateCheckout({ ...l, adresse: '' }).adresseLivraison).toBe('required')
    expect(validateCheckout({ ...l, adresse: 'court' }).adresseLivraison).toBe('addressLength')
    expect(validateCheckout({ ...l, adresse: 'x'.repeat(501) }).adresseLivraison).toBe(
      'addressLength',
    )
    expect(validateCheckout({ ...l, adresse: 'x'.repeat(10) }).adresseLivraison).toBeUndefined()
  })

  it("l'adresse n'est pas exigée hors livraison", () => {
    expect(validateCheckout(base).adresseLivraison).toBeUndefined()
  })

  it('sur place : code de table obligatoire', () => {
    const s = { ...base, type: 'SurPlace' as const }
    expect(validateCheckout(s).tableCode).toBe('tableRequired')
    expect(validateCheckout({ ...s, tableCode: 'guid' }).tableCode).toBeUndefined()
  })
})

describe('types et livraison', () => {
  it('Sur place proposé seulement avec une table mémorisée', () => {
    expect(availableTypes(false)).toEqual(['ARemporter', 'Livraison'])
    expect(availableTypes(true)).toContain('SurPlace')
  })

  it('minimum de livraison : montant manquant et blocage', () => {
    expect(deliveryInfo(15, restaurant)).toMatchObject({ belowMinimum: true, missing: 5, fee: 3 })
    expect(deliveryInfo(20, restaurant).belowMinimum).toBe(false)
  })

  it('aperçu : frais seulement en livraison', () => {
    expect(previewTotal(18, 'Livraison', 3)).toEqual({ frais: 3, total: 21 })
    expect(previewTotal(18, 'ARemporter', 3)).toEqual({ frais: 0, total: 18 })
  })

  it('canSubmit : bloque panier vide, ligne bloquante, minimum, formulaire invalide', () => {
    expect(canSubmit(cart(25), restaurant, base)).toBe(true)
    expect(canSubmit({ ...cart(25), lignes: [] }, restaurant, base)).toBe(false)
    expect(canSubmit(cart(25, { avertissement: 'indisponible' }), restaurant, base)).toBe(false)
    const livraison = { ...base, type: 'Livraison' as const, adresse: 'x'.repeat(12) }
    expect(canSubmit(cart(15), restaurant, livraison)).toBe(false)
    expect(canSubmit(cart(25), restaurant, livraison)).toBe(true)
    expect(canSubmit(cart(25), restaurant, { ...base, telephone: '' })).toBe(false)
  })
})

describe('classifyOrderError (POST /api/commandes)', () => {
  const ctx = (c: Panier | null, r: Partial<Restaurant> = {}) => ({
    cart: c,
    restaurant: { ...restaurant, ...r },
  })

  it('400 panier vide', () => {
    const e = new AppError('Votre panier est vide.', {
      status: 400,
      fieldErrors: { panier: ['vide'] },
    })
    expect(classifyOrderError(e, { cart: { ...cart(0), lignes: [] }, restaurant }).kind).toBe(
      'empty',
    )
  })

  it('400 minimum de livraison (panier non vide)', () => {
    const e = new AppError('Minimum', {
      status: 400,
      fieldErrors: { panier: ['Le montant minimum'] },
    })
    expect(classifyOrderError(e, ctx(cart(10))).kind).toBe('minimum')
  })

  it('409 commandes fermées ou restaurant fermé', () => {
    const e = new AppError('fermée', { status: 409 })
    expect(classifyOrderError(e, ctx(cart(25), { commandesOuvertes: false })).kind).toBe('closed')
    expect(classifyOrderError(e, ctx(cart(25), { ouvertMaintenant: false })).kind).toBe('closed')
  })

  it("409 articles indisponibles (d'après le panier relu)", () => {
    const e = new AppError('Ces articles ne sont plus disponibles', { status: 409 })
    const out = classifyOrderError(e, ctx(cart(25, { avertissement: 'indisponible' })))
    expect(out.kind).toBe('unavailable')
  })

  it('409 sans cause identifiable reste générique', () => {
    expect(classifyOrderError(new AppError('?', { status: 409 }), ctx(cart(25))).kind).toBe(
      'generic',
    )
  })

  it('400 erreurs par champ', () => {
    const e = new AppError('Validation', {
      status: 400,
      fieldErrors: { telephone: ['Numéro invalide'], adresseLivraison: ['Adresse obligatoire'] },
    })
    const out = classifyOrderError(e, ctx(cart(25)))
    expect(out.kind).toBe('fields')
    expect(out.fields).toEqual({
      telephone: 'Numéro invalide',
      adresseLivraison: 'Adresse obligatoire',
    })
  })

  it('réseau et 5xx', () => {
    expect(classifyOrderError(new AppError('x', { isNetwork: true }), ctx(null)).kind).toBe(
      'network',
    )
    expect(classifyOrderError(new AppError('x', { status: 500 }), ctx(null)).kind).toBe('server')
  })
})
