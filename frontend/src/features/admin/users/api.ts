import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { AdminUser, PagedResult } from '@/lib/types'

const ROOT = ['private', 'admin', 'users'] as const

export function useAdminUsers(search: string, page: number, pageSize = 20) {
  const { isAuthenticated, hasRole } = useAuth()
  return useQuery({
    queryKey: [...ROOT, search, page, pageSize],
    enabled: isAuthenticated && hasRole('Admin'),
    queryFn: async () =>
      (
        await api.get<PagedResult<AdminUser>>('/api/admin/users', {
          params: {
            page,
            pageSize: Math.min(pageSize, 50),
            ...(search.trim() ? { search: search.trim() } : {}),
          },
        })
      ).data,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

/** Activer / désactiver un compte (jamais le sien : voir rules.ts). Aucune suppression. */
export function useSetUserActive() {
  const queryClient = useQueryClient()
  return useMutation<AdminUser, Error, { id: string; estActif: boolean }>({
    mutationFn: async ({ id, estActif }) =>
      (await api.patch<AdminUser>(`/api/admin/users/${id}/actif`, { estActif })).data,
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ROOT }),
  })
}
