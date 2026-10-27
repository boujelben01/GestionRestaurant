import type { Address } from '@/lib/types'

/** Règles de AdresseRequest / AdresseRules (back-end). Les fonctions retournent des CODES d'erreur. */
export const MAX_ADDRESSES = 10
export const LIMITS = { libelle: 50, ligne: 200, ville: 100, details: 300, telephone: 20 } as const

export type AddressErrorCode = 'required' | 'tooLong' | 'phone'
export type AddressField = 'libelle' | 'ligne' | 'ville' | 'details' | 'telephone'

export interface AddressFormValues {
  libelle: string
  ligne: string
  ville: string
  details: string
  telephone: string
  estParDefaut: boolean
}

export const EMPTY_ADDRESS: AddressFormValues = {
  libelle: '',
  ligne: '',
  ville: '',
  details: '',
  telephone: '',
  estParDefaut: false,
}

const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/

export function validateAddress(
  values: AddressFormValues,
): Partial<Record<AddressField, AddressErrorCode>> {
  const errors: Partial<Record<AddressField, AddressErrorCode>> = {}
  for (const field of ['libelle', 'ligne', 'ville'] as const) {
    const value = values[field].trim()
    if (!value) errors[field] = 'required'
    else if (value.length > LIMITS[field]) errors[field] = 'tooLong'
  }
  if (values.details.trim().length > LIMITS.details) errors.details = 'tooLong'
  const phone = values.telephone.trim()
  if (!phone) errors.telephone = 'required'
  else if (phone.length > LIMITS.telephone) errors.telephone = 'tooLong'
  else if (!PHONE_RE.test(phone)) errors.telephone = 'phone'
  return errors
}

/** Corps de POST / PUT : valeurs rognées, détails vides = null. */
export function buildAddressRequest(values: AddressFormValues) {
  return {
    libelle: values.libelle.trim(),
    ligne: values.ligne.trim(),
    ville: values.ville.trim(),
    details: values.details.trim() || null,
    telephone: values.telephone.trim(),
    estParDefaut: values.estParDefaut,
  }
}

export const toFormValues = (a: Address): AddressFormValues => ({
  libelle: a.libelle,
  ligne: a.ligne,
  ville: a.ville,
  details: a.details ?? '',
  telephone: a.telephone,
  estParDefaut: a.estParDefaut,
})

export const canAddAddress = (count: number) => count < MAX_ADDRESSES

/** L'adresse par défaut (le serveur la renvoie en premier, mais on ne s'y fie pas pour l'ordre). */
export const defaultAddress = (addresses: readonly Address[]): Address | undefined =>
  addresses.find((a) => a.estParDefaut) ?? addresses[0]

/**
 * Texte envoyé comme adresse de livraison (10 à 500 caractères côté serveur) : « ligne, ville » puis les détails
 * (étage, repère) s'il y en a.
 */
export function deliveryLine(a: Pick<Address, 'ligne' | 'ville' | 'details'>): string {
  return [a.ligne, a.ville, a.details]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(', ')
}

/** Valeurs à préremplir dans le formulaire de commande en livraison. */
export function checkoutPrefill(a: Address) {
  return { adresse: deliveryLine(a), telephone: a.telephone }
}

/** Aperçu optimiste de « Définir par défaut » : une seule adresse par défaut, la défaut en premier. */
export function applyDefault(addresses: readonly Address[], id: number): Address[] {
  return addresses
    .map((a) => ({ ...a, estParDefaut: a.id === id }))
    .sort((a, b) => Number(b.estParDefaut) - Number(a.estParDefaut) || a.id - b.id)
}
