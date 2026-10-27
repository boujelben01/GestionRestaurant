import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import { cartKey, fetchCart } from '@/features/cart/api'
import { fetchRestaurant } from '@/features/restaurant/api'
import { api } from '@/lib/api'
import { toAppError } from '@/lib/errors'
import type {
  Commande,
  CommandeResume,
  CreerCommandeRequest,
  PagedResult,
  TableResponse,
} from '@/lib/types'
import { useAuth } from '@/features/auth/AuthContext'
import { OrderError, classifyOrderError } from './checkout'
import { reorder, type ReorderResult } from './reorder'
import { pollInterval } from './status'

export const ORDERS_PAGE_SIZE = 10
const ORDERS_ROOT = ['private', 'orders'] as const
export const orderKey = (id: number) => ['private', 'order', id] as const

// --- Création ---

async function createOrder(
  queryClient: QueryClient,
  request: CreerCommandeRequest,
): Promise<Commande> {
  try {
    const { data } = await api.post<Commande>('/api/commandes', request)
    return data
  } catch (raw) {
    const error = toAppError(raw)
    // Relit l'état pour classer correctement les 400/409 qui partagent un même statut.
    const [cart, restaurant] = await Promise.all([
      queryClient
        .fetchQuery({
          queryKey: cartKey(),
          queryFn: () => fetchCart(),
          staleTime: 0,
        })
        .catch(() => null),
      queryClient
        .fetchQuery({ queryKey: ['restaurant'], queryFn: fetchRestaurant, staleTime: 0 })
        .catch(() => null),
    ])
    throw new OrderError(classifyOrderError(error, { cart, restaurant }), error)
  }
}

/**
 * Crée la commande depuis le panier. `isPending` doit désactiver le bouton (anti-doublon côté
 * client ; le serveur sérialise de toute façon les créations concurrentes).
 */
export function useCreateOrder() {
  const queryClient = useQueryClient()
  return useMutation<Commande, Error, CreerCommandeRequest>({
    mutationFn: (request) => createOrder(queryClient, request),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKey(order.id), order)
      void queryClient.invalidateQueries({ queryKey: ['private', 'cart'] })
      void queryClient.invalidateQueries({ queryKey: ORDERS_ROOT })
    },
  })
}

// --- Lecture ---

/** Liste paginée « Charger plus », plus récentes d'abord (ordre du serveur). */
export function useOrders() {
  const { isAuthenticated } = useAuth()
  return useInfiniteQuery({
    queryKey: ORDERS_ROOT,
    enabled: isAuthenticated,
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const { data } = await api.get<PagedResult<CommandeResume>>('/api/commandes', {
        params: { page: pageParam, pageSize: ORDERS_PAGE_SIZE },
      })
      return data
    },
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    staleTime: 15_000,
  })
}

/**
 * Détail d'une commande. Refetch toutes les 15 s tant que le statut n'est pas final ;
 * react-query suspend le polling quand l'onglet est masqué (refetchIntervalInBackground = false).
 */
export function useOrder(id: number) {
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: orderKey(id),
    enabled: isAuthenticated && Number.isFinite(id),
    queryFn: async () => (await api.get<Commande>(`/api/commandes/${id}`)).data,
    refetchInterval: (query) => pollInterval(query.state.data?.statut),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: (query) => pollInterval(query.state.data?.statut) !== false,
    staleTime: 5_000,
  })
}

export function useCancelOrder() {
  const queryClient = useQueryClient()
  return useMutation<Commande, Error, number>({
    mutationFn: async (id) => (await api.post<Commande>(`/api/commandes/${id}/annuler`)).data,
    onSuccess: (order) => {
      queryClient.setQueryData(orderKey(order.id), order)
      void queryClient.invalidateQueries({ queryKey: ORDERS_ROOT })
    },
    // 409 : la commande a déjà changé de statut, on recharge pour afficher le vrai état.
    onError: (_e, id) => void queryClient.invalidateQueries({ queryKey: orderKey(id) }),
  })
}

// --- Tables (QR) ---

export function useReorder() {
  const queryClient = useQueryClient()
  return useMutation<ReorderResult, Error, Commande>({
    mutationFn: (order) => reorder(queryClient, order),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['private', 'cart'] }),
  })
}

export async function fetchTable(code: string): Promise<TableResponse> {
  const { data } = await api.get<TableResponse>(`/api/tables/${code}`)
  return data
}
