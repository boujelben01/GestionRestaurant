import type { TFunction } from 'i18next'
import { toAppError } from '@/lib/errors'

/** Message traduit pour une erreur d'API sur le panier (409 indisponible, 404, réseau…). */
export function cartErrorMessage(error: unknown, t: TFunction): string {
  const appError = toAppError(error)
  if (appError.isNetwork) return t('errors.network')
  if (appError.status === 409) return t('cart.errors.unavailable')
  if (appError.status === 404) return t('cart.errors.notFound')
  if (appError.status !== null && appError.status >= 500) return t('errors.server')
  return t('errors.generic')
}
