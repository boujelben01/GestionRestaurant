import type { TFunction } from 'i18next'
import { toAppError } from '@/lib/errors'

export interface FormFailure<K extends string> {
  /** Messages serveur par champ. */
  fields: Partial<Record<K, string>>
  /** Message général (alerte) : identifiants invalides, verrouillage, réseau, 5xx… */
  general?: string
}

/** Traduit une erreur d'API en messages de formulaire (par champ + général). */
export function describeFormError<K extends string>(
  error: unknown,
  t: TFunction,
  fieldKeys: readonly K[],
  context: 'login' | 'register',
): FormFailure<K> {
  const appError = toAppError(error)
  const fields: Partial<Record<K, string>> = {}
  for (const key of fieldKeys) {
    const message = appError.fieldError(key)
    if (message) fields[key] = message
  }

  if (appError.isNetwork) return { fields, general: t('errors.network') }
  if (Object.keys(fields).length > 0) return { fields, general: t('auth.errors.form') }

  switch (appError.status) {
    case 401:
      return { fields, general: t('auth.errors.invalidCredentials') }
    case 423:
    case 429:
      return { fields, general: t('auth.errors.locked') }
    case 409:
      return context === 'register'
        ? { fields: { email: t('auth.errors.emailTaken') } as Partial<Record<K, string>> }
        : { fields, general: t('errors.generic') }
    default:
      return {
        fields,
        general:
          appError.status !== null && appError.status >= 500
            ? t('errors.server')
            : t('errors.generic'),
      }
  }
}

/** N'accepte que les chemins internes (anti open-redirect) et jamais les pages d'auth. */
export function safeRedirect(from: unknown): string {
  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) return '/'
  if (from.startsWith('/connexion') || from.startsWith('/inscription')) return '/'
  return from
}
