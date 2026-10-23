import { useMutation, useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query'
import { useRef } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { Lang, Panier } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import {
  EMPTY_CART,
  applyAdd,
  applyClear,
  applyRemove,
  applySetQuantity,
  type CartArticleSnapshot,
} from './cartMath'

/** Préfixe « private » : vidé à la déconnexion (AuthContext). */
export const cartKey = (lang: Lang) => ['private', 'cart', lang] as const
const CART_ROOT = ['private', 'cart'] as const

export async function fetchCart(lang: Lang): Promise<Panier> {
  const { data } = await api.get<Panier>('/api/panier', { params: { lang } })
  return data
}

/** Panier du client connecté (désactivé pour un invité). */
export function usePanier() {
  const lang = useLang()
  const { isAuthenticated } = useAuth()
  return useQuery({
    queryKey: cartKey(lang),
    queryFn: () => fetchCart(lang),
    enabled: isAuthenticated,
    staleTime: 15_000,
  })
}

/** Nombre d'articles (somme des quantités) pour l'en-tête ; 0 pour un invité. */
export function useCartCount(): number {
  const { data } = usePanier()
  return data?.nombreArticles ?? 0
}

/**
 * Mutation de panier avec mise à jour optimiste :
 * 1. annule les chargements en cours, 2. applique `optimistic` au cache, 3. en cas d'erreur
 * revient à l'état précédent, 4. sinon remplace par la réponse du serveur (source de vérité)
 * puis invalide pour resynchroniser.
 */
function useCartMutation<TVars>(
  request: (vars: TVars, lang: Lang) => Promise<Panier>,
  optimistic: (cart: Panier, vars: TVars) => Panier,
) {
  const queryClient = useQueryClient()
  const lang = useLang()
  return useMutation<Panier, Error, TVars, { previous: Panier | undefined; key: QueryKey }>({
    mutationFn: (vars) => request(vars, lang),
    onMutate: async (vars) => {
      const key = cartKey(lang)
      await queryClient.cancelQueries({ queryKey: CART_ROOT })
      const previous = queryClient.getQueryData<Panier>(key)
      queryClient.setQueryData<Panier>(key, optimistic(previous ?? EMPTY_CART, vars))
      return { previous, key }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous)
    },
    onSuccess: (data, _vars, context) => {
      if (context) queryClient.setQueryData(context.key, data)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CART_ROOT }),
  })
}

export interface AddToCartVars {
  article: CartArticleSnapshot
  quantite?: number
}

/**
 * Ajout au panier. Anti-double-clic : tant qu'un ajout du même article est en vol, un nouvel
 * appel est ignoré (retourne false) ; deux articles différents peuvent s'ajouter en parallèle.
 */
export function useAddToCart() {
  const mutation = useCartMutation<AddToCartVars>(
    async ({ article, quantite = 1 }, lang) => {
      const { data } = await api.post<Panier>(
        '/api/panier/items',
        { articleId: article.id, quantite },
        { params: { lang } },
      )
      return data
    },
    (cart, { article, quantite = 1 }) => applyAdd(cart, article, quantite),
  )
  const inFlight = useRef(new Set<number>())

  const add = async (vars: AddToCartVars): Promise<boolean> => {
    if (inFlight.current.has(vars.article.id)) return false
    inFlight.current.add(vars.article.id)
    try {
      await mutation.mutateAsync(vars)
      return true
    } finally {
      inFlight.current.delete(vars.article.id)
    }
  }
  return { add, isPending: mutation.isPending, pendingArticleId: mutation.variables?.article.id }
}

export function useSetQuantity() {
  return useCartMutation<{ articleId: number; quantite: number }>(
    async ({ articleId, quantite }, lang) => {
      const { data } = await api.put<Panier>(
        `/api/panier/items/${articleId}`,
        { quantite },
        { params: { lang } },
      )
      return data
    },
    (cart, { articleId, quantite }) => applySetQuantity(cart, articleId, quantite),
  )
}

export function useRemoveItem() {
  return useCartMutation<{ articleId: number }>(
    async ({ articleId }, lang) => {
      const { data } = await api.delete<Panier>(`/api/panier/items/${articleId}`, {
        params: { lang },
      })
      return data
    },
    (cart, { articleId }) => applyRemove(cart, articleId),
  )
}

export function useClearCart() {
  return useCartMutation<void>(
    async () => {
      const { data } = await api.delete<Panier>('/api/panier')
      return data
    },
    (cart) => applyClear(cart),
  )
}
