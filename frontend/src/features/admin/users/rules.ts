import type { AdminUser } from '@/lib/types'

/**
 * Un administrateur ne peut pas se désactiver lui-même (le back-end répond 400 sinon) : le bouton est
 * désactivé sur sa propre ligne, avec une explication. L'identité vient du profil (/api/auth/me).
 */
export const isSelf = (target: Pick<AdminUser, 'id'>, currentUserId: string | undefined) =>
  currentUserId !== undefined && target.id === currentUserId

export const canToggleUser = (target: Pick<AdminUser, 'id'>, currentUserId: string | undefined) =>
  !isSelf(target, currentUserId)
