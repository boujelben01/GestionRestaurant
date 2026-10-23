import type { TFunction } from 'i18next'
import { validateCheckout } from '@/features/orders/checkout'
import type { FieldErrors } from '@/features/auth/validation'

export const NAME_MAX = 100
export const PASSWORD_MIN = 8

/** Profil : nom facultatif (100 max), téléphone facultatif avec la même règle que la commande. */
export function validateProfile(
  values: { nom: string; telephone: string },
  t: TFunction,
): FieldErrors<'nom' | 'telephone'> {
  const errors: FieldErrors<'nom' | 'telephone'> = {}
  if (values.nom.trim().length > NAME_MAX) errors.nom = t('validation.tooLong', { max: NAME_MAX })
  const phone = values.telephone.trim()
  if (phone) {
    const check = validateCheckout({
      type: 'ARemporter',
      telephone: phone,
      note: '',
      adresse: '',
      tableCode: null,
    })
    if (check.telephone) errors.telephone = t('validation.phone')
  }
  return errors
}

/** Changement de mot de passe : ancien requis, nouveau 8 caractères minimum, confirmation identique. */
export function validatePasswordChange(
  values: { currentPassword: string; newPassword: string; confirm: string },
  t: TFunction,
): FieldErrors<'currentPassword' | 'newPassword' | 'confirm'> {
  const errors: FieldErrors<'currentPassword' | 'newPassword' | 'confirm'> = {}
  if (!values.currentPassword) errors.currentPassword = t('validation.required')
  if (!values.newPassword) errors.newPassword = t('validation.required')
  else if (values.newPassword.length < PASSWORD_MIN) {
    errors.newPassword = t('validation.passwordMin', { min: PASSWORD_MIN })
  }
  if (!values.confirm) errors.confirm = t('validation.required')
  else if (values.confirm !== values.newPassword) errors.confirm = t('profile.password.mismatch')
  return errors
}
