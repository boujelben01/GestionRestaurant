import type { Horaire } from '@/lib/types'
import { parsePrice, priceError, type MenuErrorCode } from '../menu/validation'

/** Règles de UpdateRestaurantRequest / HoraireRequest (back-end). Les fonctions retournent des codes. */
export type SettingsErrorCode = 'required' | 'tooLong' | 'email' | 'phone' | MenuErrorCode

export interface SettingsFormValues {
  nom: string
  telephone: string
  email: string
  adresse: string
  fraisLivraison: string
  montantMinimumLivraison: string
}

export type SettingsField = keyof SettingsFormValues

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/

export function validateSettings(
  values: SettingsFormValues,
): Partial<Record<SettingsField, SettingsErrorCode>> {
  const errors: Partial<Record<SettingsField, SettingsErrorCode>> = {}
  const text = (field: 'nom' | 'telephone' | 'email' | 'adresse', max: number) => {
    const value = values[field].trim()
    if (!value) errors[field] = 'required'
    else if (value.length > max) errors[field] = 'tooLong'
    return value
  }
  text('nom', 100)
  const phone = text('telephone', 20)
  if (!errors.telephone && !PHONE_RE.test(phone)) errors.telephone = 'phone'
  const email = text('email', 150)
  if (!errors.email && !EMAIL_RE.test(email)) errors.email = 'email'
  text('adresse', 300)
  for (const field of ['fraisLivraison', 'montantMinimumLivraison'] as const) {
    const error = priceError(values[field])
    if (error) errors[field] = error
  }
  return errors
}

export function buildSettingsRequest(values: SettingsFormValues) {
  return {
    nom: values.nom.trim(),
    telephone: values.telephone.trim(),
    email: values.email.trim(),
    adresse: values.adresse.trim(),
    fraisLivraison: parsePrice(values.fraisLivraison) as number,
    montantMinimumLivraison: parsePrice(values.montantMinimumLivraison) as number,
  }
}

// --- Horaires ---

export interface DayForm {
  jourSemaine: number
  estFerme: boolean
  ouverture: string
  fermeture: string
}

export function toDayForms(horaires: readonly Horaire[]): DayForm[] {
  return Array.from({ length: 7 }, (_, jourSemaine) => {
    const h = horaires.find((x) => x.jourSemaine === jourSemaine)
    return {
      jourSemaine,
      estFerme: h?.estFerme ?? true,
      ouverture: h?.ouverture ?? '',
      fermeture: h?.fermeture ?? '',
    }
  })
}

/** Fermeture avant l'ouverture = fermeture après minuit (même convention que le back-end). */
export function isOvernight(day: Pick<DayForm, 'estFerme' | 'ouverture' | 'fermeture'>): boolean {
  return (
    !day.estFerme &&
    TIME_RE.test(day.ouverture) &&
    TIME_RE.test(day.fermeture) &&
    day.fermeture < day.ouverture
  )
}

export type DayErrors = Partial<Record<'ouverture' | 'fermeture', 'required' | 'format' | 'same'>>

export function validateDay(day: DayForm): DayErrors {
  if (day.estFerme) return {}
  const errors: DayErrors = {}
  for (const field of ['ouverture', 'fermeture'] as const) {
    if (!day[field]) errors[field] = 'required'
    else if (!TIME_RE.test(day[field])) errors[field] = 'format'
  }
  if (!errors.ouverture && !errors.fermeture && day.ouverture === day.fermeture)
    errors.fermeture = 'same'
  return errors
}

export const validateDays = (days: readonly DayForm[]) => days.map(validateDay)
export const daysAreValid = (days: readonly DayForm[]) =>
  validateDays(days).every((e) => Object.keys(e).length === 0)

/** Corps de PUT .../horaires : un jour fermé n'envoie pas d'heures. */
export function buildHorairesRequest(days: readonly DayForm[]) {
  return {
    horaires: days.map((d) => ({
      jourSemaine: d.jourSemaine,
      estFerme: d.estFerme,
      ouverture: d.estFerme ? null : d.ouverture,
      fermeture: d.estFerme ? null : d.fermeture,
    })),
  }
}
