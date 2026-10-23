import type { TFunction } from 'i18next'

/** Règles alignées sur l'API (RegisterRequest / LoginRequest). Retourne une clé i18n ou undefined. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^\+?[0-9 ().-]{6,20}$/

export type FieldErrors<K extends string> = Partial<Record<K, string>>

export function validateLogin(
  values: { identifiant: string; password: string },
  t: TFunction,
): FieldErrors<'identifiant' | 'password'> {
  const errors: FieldErrors<'identifiant' | 'password'> = {}
  if (!values.identifiant.trim()) errors.identifiant = t('validation.required')
  if (!values.password) errors.password = t('validation.required')
  return errors
}

export function validateRegister(
  values: { nom: string; email: string; password: string; telephone: string },
  t: TFunction,
): FieldErrors<'nom' | 'email' | 'password' | 'telephone'> {
  const errors: FieldErrors<'nom' | 'email' | 'password' | 'telephone'> = {}
  if (!values.nom.trim()) errors.nom = t('validation.required')
  else if (values.nom.length > 100) errors.nom = t('validation.tooLong', { max: 100 })
  if (!values.email.trim()) errors.email = t('validation.required')
  else if (!EMAIL_RE.test(values.email.trim())) errors.email = t('validation.email')
  if (!values.password) errors.password = t('validation.required')
  else if (values.password.length < 8) errors.password = t('validation.passwordMin', { min: 8 })
  if (values.telephone.trim() && !PHONE_RE.test(values.telephone.trim())) {
    errors.telephone = t('validation.phone')
  }
  return errors
}
