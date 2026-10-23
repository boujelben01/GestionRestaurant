import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type {
  ActiveOrder,
  AdminOrder,
  AdminOrderSummary,
  OrderCounters,
  PagedResult,
  StatutCommande,
  TypeCommande,
} from '@/lib/types'
import { leavesBoard } from './transitions'

export const ADMIN_POLL_MS = 10_000
const ROOT = ['private', 'admin', 'orders'] as const
export const activeOrdersKey = [...ROOT, 'active'] as const
export const countersKey = [...ROOT, 'counters'] as const
export const orderDetailKey = (id: number, version?: number) =>
  version === undefined
    ? ([...ROOT, 'detail', id] as const)
    : ([...ROOT, 'detail', id, version] as const)

const isAdmin = (hasRole: (role: string) => boolean) => hasRole('Admin')

// --- Écran principal : commandes actives et compteurs (polling 10 s, pause onglet masqué) ---

export function useActiveOrders() {
  const { isAuthenticated, hasRole } = useAuth()
  return useQuery({
    queryKey: activeOrdersKey,
    enabled: isAuthenticated && isAdmin(hasRole),
    queryFn: async () => (await api.get<ActiveOrder[]>('/api/admin/commandes/actives')).data,
    refetchInterval: ADMIN_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}

export function useOrderCounters() {
  const { isAuthenticated, hasRole } = useAuth()
  return useQuery({
    queryKey: countersKey,
    enabled: isAuthenticated && isAdmin(hasRole),
    queryFn: async () => (await api.get<OrderCounters>('/api/admin/commandes/compteurs')).data,
    refetchInterval: ADMIN_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 0,
  })
}

/**
 * Détail d'une commande. `version` fait partie de la clé : GET /actives ne renvoie ni téléphone,
 * ni total, ni paiement, ni adresse ; on charge donc le détail une fois par version de la commande
 * (une modification change la version et déclenche un nouveau chargement).
 */
export function useAdminOrder(id: number | null, version?: number) {
  const { isAuthenticated, hasRole } = useAuth()
  return useQuery({
    queryKey: orderDetailKey(id ?? -1, version),
    enabled: id !== null && isAuthenticated && isAdmin(hasRole),
    queryFn: async () => (await api.get<AdminOrder>(`/api/admin/commandes/${id}`)).data,
    staleTime: 60_000,
  })
}

// --- Historique : liste filtrée et paginée ---

export interface OrderFilters {
  statut: StatutCommande[]
  typeCommande: TypeCommande | ''
  estPayee: boolean | null
  du: string
  au: string
  recherche: string
}

export const EMPTY_FILTERS: OrderFilters = {
  statut: [],
  typeCommande: '',
  estPayee: null,
  du: '',
  au: '',
  recherche: '',
}

/** Paramètres de requête : n'envoie que les filtres renseignés ; statuts séparés par des virgules. */
export function filtersToParams(filters: OrderFilters, page: number, pageSize: number) {
  const params: Record<string, string | number | boolean> = { page, pageSize }
  if (filters.statut.length > 0) params.statut = filters.statut.join(',')
  if (filters.typeCommande) params.typeCommande = filters.typeCommande
  if (filters.estPayee !== null) params.estPayee = filters.estPayee
  if (filters.du) params.du = filters.du
  if (filters.au) params.au = filters.au
  if (filters.recherche.trim()) params.recherche = filters.recherche.trim()
  return params
}

export function useAdminOrders(filters: OrderFilters, page: number, pageSize = 20) {
  const { isAuthenticated, hasRole } = useAuth()
  return useQuery({
    queryKey: [...ROOT, 'list', filters, page, pageSize],
    enabled: isAuthenticated && isAdmin(hasRole),
    queryFn: async () =>
      (
        await api.get<PagedResult<AdminOrderSummary>>('/api/admin/commandes', {
          params: filtersToParams(filters, page, pageSize),
        })
      ).data,
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  })
}

// --- Changements de statut et de paiement ---

interface StatusVars {
  order: Pick<ActiveOrder, 'id' | 'version'>
  statut: StatutCommande
}

/**
 * Change le statut en envoyant la `version` lue. Mise à jour OPTIMISTE de l'écran : la carte change
 * de colonne (ou disparaît si Terminee/Annulee) tout de suite ; en cas d'erreur (409 transition interdite
 * ou modifiée entre-temps, réseau) l'état précédent est restauré, puis tout est rechargé.
 */
export function useChangeOrderStatus() {
  const queryClient = useQueryClient()
  return useMutation<AdminOrder, Error, StatusVars, { previous: ActiveOrder[] | undefined }>({
    mutationFn: async ({ order, statut }) =>
      (
        await api.patch<AdminOrder>(`/api/admin/commandes/${order.id}/statut`, {
          statut,
          version: order.version,
        })
      ).data,
    onMutate: async ({ order, statut }) => {
      await queryClient.cancelQueries({ queryKey: activeOrdersKey })
      const previous = queryClient.getQueryData<ActiveOrder[]>(activeOrdersKey)
      queryClient.setQueryData<ActiveOrder[]>(activeOrdersKey, (list) =>
        leavesBoard(statut)
          ? list?.filter((o) => o.id !== order.id)
          : list?.map((o) => (o.id === order.id ? { ...o, statut } : o)),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(activeOrdersKey, context.previous)
    },
    onSuccess: (detail, { order }) => {
      queryClient.setQueryData(orderDetailKey(detail.id, detail.version), detail)
      // La commande a une nouvelle version : on la reporte sur la carte pour le prochain PATCH.
      queryClient.setQueryData<ActiveOrder[]>(activeOrdersKey, (list) =>
        list?.map((o) =>
          o.id === order.id
            ? {
                ...o,
                statut: detail.statut,
                version: detail.version,
                dateMiseAJour: detail.dateMiseAJour,
              }
            : o,
        ),
      )
    },
    // Succès ou échec : on resynchronise avec le serveur (source de vérité).
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: activeOrdersKey })
      void queryClient.invalidateQueries({ queryKey: countersKey })
      void queryClient.invalidateQueries({ queryKey: [...ROOT, 'list'] })
    },
  })
}

export function useSetOrderPaid() {
  const queryClient = useQueryClient()
  type Snapshot = Array<[readonly unknown[], AdminOrder | undefined]>
  return useMutation<AdminOrder, Error, { id: number; estPayee: boolean }, { snapshots: Snapshot }>(
    {
      mutationFn: async ({ id, estPayee }) =>
        (await api.patch<AdminOrder>(`/api/admin/commandes/${id}/paiement`, { estPayee })).data,
      onMutate: async ({ id, estPayee }) => {
        // Optimiste sur TOUS les détails en cache de cette commande (une entrée par version).
        await queryClient.cancelQueries({ queryKey: [...ROOT, 'detail', id] })
        const snapshots = queryClient.getQueriesData<AdminOrder>({
          queryKey: [...ROOT, 'detail', id],
        })
        snapshots.forEach(
          ([key, data]) => data && queryClient.setQueryData(key, { ...data, estPayee }),
        )
        return { snapshots }
      },
      onError: (_error, _vars, context) => {
        context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
      },
      onSuccess: (detail) => {
        queryClient.setQueryData(orderDetailKey(detail.id, detail.version), detail)
      },
      onSettled: (_data, _error, { id }) => {
        void queryClient.invalidateQueries({ queryKey: [...ROOT, 'detail', id] })
        void queryClient.invalidateQueries({ queryKey: activeOrdersKey })
        void queryClient.invalidateQueries({ queryKey: [...ROOT, 'list'] })
      },
    },
  )
}
