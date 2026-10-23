import { useMutation } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { Lang, User } from '@/lib/types'

export interface UpdateProfileInput {
  nom: string
  telephone: string
  langueFavorite: Lang
}

/** PUT /api/auth/me puis rechargement du profil dans AuthContext. */
export function useUpdateProfile() {
  const { refreshProfile } = useAuth()
  return useMutation<User, Error, UpdateProfileInput>({
    mutationFn: async (input) => {
      const { data } = await api.put<User>('/api/auth/me', {
        nom: input.nom.trim() || null,
        telephone: input.telephone.trim() || null,
        langueFavorite: input.langueFavorite,
      })
      return data
    },
    onSuccess: () => refreshProfile(),
  })
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

/** POST /api/auth/me/password (204). Erreurs par champ : currentPassword, newPassword. */
export function useChangePassword() {
  return useMutation<void, Error, ChangePasswordInput>({
    mutationFn: async (input) => {
      await api.post('/api/auth/me/password', input)
    },
  })
}
