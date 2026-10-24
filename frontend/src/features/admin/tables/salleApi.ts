import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { SalleTable } from '@/lib/types'
import { applyCollect, applyRelease } from './salle'

export const SALLE_POLL_MS = 10_000
export const salleKey = ['private', 'admin', 'tables', 'salle'] as const

/**
 * Plan de salle, relevé toutes les 10 s (suspendu quand l'onglet est masqué, relancé au retour).
 * La clé commence par ['private','admin','tables'] : la liste « Gestion » est invalidée avec elle.
 */
export function useSalle() {
  const { isAuthenticated, hasRole } = useAuth()
  return useQuery({
    queryKey: salleKey,
    enabled: isAuthenticated && hasRole('Admin'),
    queryFn: async () => (await api.get<SalleTable[]>('/api/admin/tables/salle')).data,
    refetchInterval: SALLE_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}

type Action = 'encaisser' | 'liberer'

/**
 * « Encaisser » / « Libérer » : mise à jour OPTIMISTE de la table concernée, retour arrière si le serveur
 * refuse (409 : rien à encaisser, commandes en cours ou non payées), puis rechargement depuis le serveur.
 */
function useSalleAction(action: Action, preview: (table: SalleTable) => SalleTable) {
  const queryClient = useQueryClient()
  return useMutation<SalleTable, Error, { id: number }, { previous: SalleTable[] | undefined }>({
    mutationFn: async ({ id }) =>
      (await api.post<SalleTable>(`/api/admin/tables/${id}/${action}`)).data,
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: salleKey })
      const previous = queryClient.getQueryData<SalleTable[]>(salleKey)
      queryClient.setQueryData<SalleTable[]>(salleKey, (list) =>
        list?.map((t) => (t.id === id ? preview(t) : t)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(salleKey, context.previous)
    },
    onSuccess: (table) => {
      queryClient.setQueryData<SalleTable[]>(salleKey, (list) =>
        list?.map((t) => (t.id === table.id ? table : t)),
      )
    },
    // Les commandes ont changé (paiement, statut) : écran des commandes et compteurs à resynchroniser aussi.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: salleKey })
      void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'orders'] })
    },
  })
}

export const useCollectTable = () => useSalleAction('encaisser', applyCollect)
export const useReleaseTable = () => useSalleAction('liberer', applyRelease)
