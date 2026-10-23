import type { TFunction } from 'i18next'
import { toAppError } from '@/lib/errors'

/** Message traduit pour une erreur d'API d'administration ; `conflictKey` précise le cas 409. */
export function adminErrorMessage(error: unknown, t: TFunction, conflictKey?: string): string {
  const e = toAppError(error)
  if (e.isNetwork) return t('errors.network')
  if (e.status === 409 && conflictKey) return t(conflictKey)
  if (e.status === 403) return t('admin.errors.forbidden')
  if (e.status !== null && e.status >= 500) return t('errors.server')
  return t('errors.generic')
}
