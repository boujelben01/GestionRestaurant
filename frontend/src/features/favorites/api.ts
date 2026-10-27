import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { FavoriteArticle } from '@/lib/types'

/** Clés sous « private » : vidées à la déconnexion. */
export const favoriteIdsKey = ['private', 'favorites', 'ids'] as const
const listRoot = ['private', 'favorites', 'list'] as const

/**
 * Favoris et adresses sont réservés aux CLIENTS connectés : un administrateur n'en a pas l'usage (il ne commande
 * pas) et l'interface les lui cache. Le back-end, lui, accepte tout utilisateur authentifié.
 */
export function useCustomerFeatures(): boolean {
  const { isAuthenticated, hasRole } = useAuth()
  return isAuthenticated && !hasRole('Admin')
}

/** Identifiants des favoris (pour les cœurs) ; vide pour un invité ou un administrateur. */
export function useFavoriteIds() {
  const enabled = useCustomerFeatures()
  return useQuery({
    queryKey: favoriteIdsKey,
    enabled,
    queryFn: async () => (await api.get<number[]>('/api/favoris/ids')).data,
    staleTime: 60_000,
  })
}

/** Articles favoris ; un article désactivé reste listé avec `actif: false`. */
export function useFavorites() {
  const enabled = useCustomerFeatures()
  return useQuery({
    queryKey: listRoot,
    enabled,
    queryFn: async () => (await api.get<FavoriteArticle[]>('/api/favoris')).data,
    staleTime: 30_000,
  })
}

/** Ajoute ou retire un identifiant d'une liste (sans doublon), l'ordre existant est conservé. */
export function withFavorite(
  ids: readonly number[],
  articleId: number,
  favorite: boolean,
): number[] {
  const without = ids.filter((id) => id !== articleId)
  return favorite ? [articleId, ...without] : without
}

/**
 * Bascule d'un favori, OPTIMISTE : le cœur change tout de suite, retour arrière si le serveur refuse (404 article
 * devenu inactif, réseau). Un second clic sur le même article pendant qu'une requête est en vol est ignoré
 * (retourne false) : pas de requêtes qui se croisent.
 */
export function useToggleFavorite() {
  const queryClient = useQueryClient()
  const inFlight = useRef(new Set<number>())
  const mutation = useMutation<
    void,
    Error,
    { articleId: number; favorite: boolean },
    { previous: number[] | undefined }
  >({
    mutationFn: async ({ articleId, favorite }) => {
      if (favorite) await api.put(`/api/favoris/${articleId}`)
      else await api.delete(`/api/favoris/${articleId}`)
    },
    onMutate: async ({ articleId, favorite }) => {
      await queryClient.cancelQueries({ queryKey: favoriteIdsKey })
      const previous = queryClient.getQueryData<number[]>(favoriteIdsKey)
      queryClient.setQueryData<number[]>(favoriteIdsKey, (ids) =>
        withFavorite(ids ?? [], articleId, favorite),
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(favoriteIdsKey, context.previous)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: favoriteIdsKey })
      void queryClient.invalidateQueries({ queryKey: listRoot })
    },
  })

  const toggle = async (articleId: number, favorite: boolean): Promise<boolean> => {
    if (inFlight.current.has(articleId)) return false
    inFlight.current.add(articleId)
    try {
      await mutation.mutateAsync({ articleId, favorite })
      return true
    } finally {
      inFlight.current.delete(articleId)
    }
  }
  return { toggle, isPending: mutation.isPending }
}
