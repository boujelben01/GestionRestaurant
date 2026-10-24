import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { AdminTable } from '@/lib/types'
import { buildTableRequest, type TableFormValues } from './validation'

export const tablesKey = ['private', 'admin', 'tables'] as const

export function useAdminTables() {
  const { isAuthenticated, hasRole } = useAuth()
  return useQuery({
    queryKey: tablesKey,
    enabled: isAuthenticated && hasRole('Admin'),
    queryFn: async () => (await api.get<AdminTable[]>('/api/admin/tables')).data,
    staleTime: 15_000,
  })
}

function useTablesMutation<TVars>(request: (vars: TVars) => Promise<AdminTable>) {
  const queryClient = useQueryClient()
  return useMutation<AdminTable, Error, TVars>({
    mutationFn: request,
    // Le serveur fait foi (numéro automatique, nouveau code) : on recharge la liste après chaque succès.
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: tablesKey }),
  })
}

/** Création : `numero` vide = numéro automatique. Un numéro déjà pris donne un 409. */
export const useCreateTable = () =>
  useTablesMutation<TableFormValues>(
    async (values) =>
      (await api.post<AdminTable>('/api/admin/tables', buildTableRequest(values))).data,
  )

export const useUpdateTable = () =>
  useTablesMutation<{ id: number; values: TableFormValues }>(
    async ({ id, values }) =>
      (await api.put<AdminTable>(`/api/admin/tables/${id}`, buildTableRequest(values))).data,
  )

export const useSetTableActive = () =>
  useTablesMutation<{ id: number; estActive: boolean }>(
    async ({ id, estActive }) =>
      (await api.patch<AdminTable>(`/api/admin/tables/${id}/active`, { estActive })).data,
  )

/** Nouveau code : les QR déjà imprimés avec l'ancien cessent de fonctionner immédiatement. */
export const useRegenerateTableCode = () =>
  useTablesMutation<{ id: number }>(
    async ({ id }) => (await api.post<AdminTable>(`/api/admin/tables/${id}/regenerer-code`)).data,
  )
