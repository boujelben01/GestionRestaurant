import { AppError } from '@/lib/errors'
import type { CreerCommandeRequest, Panier, Restaurant, TypeCommande } from '@/lib/types'
import { blockedLines } from '@/features/cart/cartMath'

export const ADDRESS_MIN = 10
export const ADDRESS_MAX = 500
export const NOTE_MAX = 500
export const PHONE_MAX = 20

/** Même contrainte que [Phone] de l'API : chiffres, +, espaces, tirets, parenthèses, points. */
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/

export interface CheckoutValues {
  type: TypeCommande
  telephone: string
  note: string
  adresse: string
  /** Code de table mémorisé (QR) ; requis pour SurPlace. */
  tableCode: string | null
}

export type CheckoutField = 'telephone' | 'note' | 'adresseLivraison' | 'tableCode'
export type CheckoutErrorCode = 'required' | 'phone' | 'tooLong' | 'addressLength' | 'tableRequired'
export type CheckoutFieldErrors = Partial<Record<CheckoutField, CheckoutErrorCode>>

/** Types de commande proposés : « SurPlace » seulement si une table est mémorisée. */
export function availableTypes(hasTable: boolean): TypeCommande[] {
  return hasTable ? ['ARemporter', 'Livraison', 'SurPlace'] : ['ARemporter', 'Livraison']
}

/**
 * Corps de POST /api/commandes : SEULS les champs applicables au type sont envoyés (le serveur
 * refuse en 400 une adresse hors livraison ou un code de table hors sur-place).
 */
export function buildOrderRequest(values: CheckoutValues): CreerCommandeRequest {
  const request: CreerCommandeRequest = {
    typeCommande: values.type,
    telephone: values.telephone.trim(),
  }
  const note = values.note.trim()
  if (note) request.note = note
  if (values.type === 'Livraison') request.adresseLivraison = values.adresse.trim()
  if (values.type === 'SurPlace' && values.tableCode) request.tableCode = values.tableCode
  return request
}

export function validateCheckout(values: CheckoutValues): CheckoutFieldErrors {
  const errors: CheckoutFieldErrors = {}
  const phone = values.telephone.trim()
  if (!phone) errors.telephone = 'required'
  else if (phone.length > PHONE_MAX || !PHONE_RE.test(phone)) errors.telephone = 'phone'
  if (values.note.trim().length > NOTE_MAX) errors.note = 'tooLong'
  if (values.type === 'Livraison') {
    const length = values.adresse.trim().length
    if (length === 0) errors.adresseLivraison = 'required'
    else if (length < ADDRESS_MIN || length > ADDRESS_MAX) errors.adresseLivraison = 'addressLength'
  }
  if (values.type === 'SurPlace' && !values.tableCode) errors.tableCode = 'tableRequired'
  return errors
}

export interface DeliveryInfo {
  fee: number
  minimum: number
  /** Vrai si le sous-total est sous le minimum : la commande en livraison est bloquée. */
  belowMinimum: boolean
  /** Montant manquant pour atteindre le minimum (0 sinon). */
  missing: number
}

export function deliveryInfo(sousTotal: number, restaurant: Restaurant | undefined): DeliveryInfo {
  const fee = restaurant?.fraisLivraison ?? 0
  const minimum = restaurant?.montantMinimumLivraison ?? 0
  const belowMinimum = sousTotal < minimum
  return {
    fee,
    minimum,
    belowMinimum,
    missing: belowMinimum ? Math.round((minimum - sousTotal) * 100) / 100 : 0,
  }
}

/** Aperçu des frais avant confirmation. Le total FAISANT FOI est celui de la commande créée. */
export function previewTotal(sousTotal: number, type: TypeCommande, fee: number) {
  const frais = type === 'Livraison' ? fee : 0
  return { frais, total: Math.round((sousTotal + frais) * 100) / 100 }
}

export function canSubmit(
  cart: Panier | undefined,
  restaurant: Restaurant | undefined,
  values: CheckoutValues,
): boolean {
  if (!cart || cart.lignes.length === 0 || blockedLines(cart).length > 0) return false
  if (Object.keys(validateCheckout(values)).length > 0) return false
  if (values.type === 'Livraison' && deliveryInfo(cart.sousTotal, restaurant).belowMinimum) {
    return false
  }
  return true
}

// --- Erreurs de POST /api/commandes ---

export type OrderFailureKind =
  | 'empty' // 400 panier vide
  | 'minimum' // 400 minimum de livraison
  | 'closed' // 409 commandes fermées ou restaurant fermé
  | 'unavailable' // 409 articles indisponibles
  | 'fields' // 400 erreurs de champ
  | 'network'
  | 'server'
  | 'generic'

export interface OrderFailure {
  kind: OrderFailureKind
  /** Erreurs serveur par champ, clés alignées sur CheckoutField. */
  fields: Partial<Record<CheckoutField, string>>
  /** Message brut du serveur (français) : affiché en dernier recours seulement. */
  serverMessage?: string
}

export interface OrderContext {
  /** Panier relu après l'échec (null si indisponible). */
  cart: Panier | null
  restaurant: Restaurant | null
}

/**
 * Classe une erreur de création de commande.
 * Le serveur ne renvoie que du texte (pas de code d'erreur) : pour distinguer les cas qui
 * partagent un statut (409 fermé / indisponible ; 400 panier vide / minimum), on s'appuie sur
 * l'ÉTAT RELU (panier, restaurant), pas sur le libellé français du message.
 */
export function classifyOrderError(error: AppError, context: OrderContext): OrderFailure {
  const fields: OrderFailure['fields'] = {}
  for (const key of ['telephone', 'note', 'adresseLivraison', 'tableCode'] as const) {
    const message = error.fieldError(key)
    if (message) fields[key] = message
  }
  const base = { fields, serverMessage: error.message }

  if (error.isNetwork) return { ...base, kind: 'network' }
  if (error.status !== null && error.status >= 500) return { ...base, kind: 'server' }

  if (error.status === 409) {
    if (blockedLines(context.cart ?? undefined).length > 0) return { ...base, kind: 'unavailable' }
    const r = context.restaurant
    if (r && (!r.commandesOuvertes || !r.ouvertMaintenant)) return { ...base, kind: 'closed' }
    return { ...base, kind: 'generic' }
  }

  if (error.status === 400) {
    if (error.fieldError('panier') !== undefined) {
      return { ...base, kind: context.cart && context.cart.lignes.length > 0 ? 'minimum' : 'empty' }
    }
    if (Object.keys(fields).length > 0) return { ...base, kind: 'fields' }
  }
  return { ...base, kind: 'generic' }
}

/** Erreur typée levée par useCreateOrder : porte la classification pour l'écran. */
export class OrderError extends Error {
  readonly failure: OrderFailure
  readonly cause: AppError
  constructor(failure: OrderFailure, cause: AppError) {
    super(cause.message)
    this.name = 'OrderError'
    this.failure = failure
    this.cause = cause
  }
}
