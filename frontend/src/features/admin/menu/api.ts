import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { AdminArticle, AdminCategory, PagedResult } from '@/lib/types'
import { buildArticleRequest, type ArticleFormValues } from './validation'

const ROOT = ['private', 'admin', 'menu'] as const
export const categoriesKey = [...ROOT, 'categories'] as const
export const articlesKey = [...ROOT, 'articles'] as const

/** Le menu public (['menu']) est mis en cache 60 s côté serveur ; on invalide aussi le cache local. */
function useRefreshPublicMenu() {
  const queryClient = useQueryClient()
  return () => void queryClient.invalidateQueries({ queryKey: ['menu'] })
}

function useAdminEnabled() {
  const { isAuthenticated, hasRole } = useAuth()
  return isAuthenticated && hasRole('Admin')
}

// --- Catégories ---

export function useAdminCategories() {
  const enabled = useAdminEnabled()
  return useQuery({
    queryKey: categoriesKey,
    enabled,
    queryFn: async () => (await api.get<AdminCategory[]>('/api/admin/categories')).data,
    staleTime: 30_000,
  })
}

export interface CategoryInput {
  nomFr: string
}

export function useSaveCategory() {
  const queryClient = useQueryClient()
  const refreshPublic = useRefreshPublicMenu()
  return useMutation<AdminCategory, Error, { id?: number; values: CategoryInput }>({
    mutationFn: async ({ id, values }) => {
      const body = { nomFr: values.nomFr.trim() }
      const { data } =
        id === undefined
          ? await api.post<AdminCategory>('/api/admin/categories', body)
          : await api.put<AdminCategory>(`/api/admin/categories/${id}`, body)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey })
      refreshPublic()
    },
  })
}

/** Activer / désactiver ; le serveur répond 409 si la catégorie a encore des articles actifs. */
export function useSetCategoryActive() {
  const queryClient = useQueryClient()
  const refreshPublic = useRefreshPublicMenu()
  return useMutation<AdminCategory, Error, { id: number; estActive: boolean }>({
    mutationFn: async ({ id, estActive }) =>
      (await api.patch<AdminCategory>(`/api/admin/categories/${id}/active`, { estActive })).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey })
      refreshPublic()
    },
  })
}

/** PUT .../ordre avec la liste complète des identifiants dans le nouvel ordre (optimiste, retour arrière). */
export function useReorderCategories() {
  const queryClient = useQueryClient()
  const refreshPublic = useRefreshPublicMenu()
  return useMutation<AdminCategory[], Error, number[], { previous?: AdminCategory[] }>({
    mutationFn: async (ids) =>
      (await api.put<AdminCategory[]>('/api/admin/categories/ordre', { ids })).data,
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: categoriesKey })
      const previous = queryClient.getQueryData<AdminCategory[]>(categoriesKey)
      if (previous) {
        const byId = new Map(previous.map((c) => [c.id, c]))
        const reordered = ids.flatMap((id, index) => {
          const c = byId.get(id)
          return c ? [{ ...c, ordre: index + 1 }] : []
        })
        queryClient.setQueryData(categoriesKey, reordered)
      }
      return { previous }
    },
    onError: (_e, _ids, context) => {
      if (context?.previous) queryClient.setQueryData(categoriesKey, context.previous)
    },
    onSuccess: (data) => queryClient.setQueryData(categoriesKey, data),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: categoriesKey })
      refreshPublic()
    },
  })
}

// --- Articles ---

export interface ArticleFilters {
  categorieId: number | null
  actif: boolean | null
  disponible: boolean | null
  recherche: string
}

export const EMPTY_ARTICLE_FILTERS: ArticleFilters = {
  categorieId: null,
  actif: null,
  disponible: null,
  recherche: '',
}

export function articleFiltersToParams(filters: ArticleFilters, page: number, pageSize: number) {
  const params: Record<string, string | number | boolean> = { page, pageSize }
  if (filters.categorieId !== null) params.categorieId = filters.categorieId
  if (filters.actif !== null) params.actif = filters.actif
  if (filters.disponible !== null) params.disponible = filters.disponible
  if (filters.recherche.trim()) params.recherche = filters.recherche.trim()
  return params
}

export function useAdminArticles(filters: ArticleFilters, page: number, pageSize = 20) {
  const enabled = useAdminEnabled()
  return useQuery({
    queryKey: [...articlesKey, filters, page, pageSize],
    enabled,
    queryFn: async () =>
      (
        await api.get<PagedResult<AdminArticle>>('/api/admin/articles', {
          params: articleFiltersToParams(filters, page, pageSize),
        })
      ).data,
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  })
}

export function useSaveArticle() {
  const queryClient = useQueryClient()
  const refreshPublic = useRefreshPublicMenu()
  return useMutation<AdminArticle, Error, { id?: number; values: ArticleFormValues }>({
    mutationFn: async ({ id, values }) => {
      const body = buildArticleRequest(values)
      const { data } =
        id === undefined
          ? await api.post<AdminArticle>('/api/admin/articles', body)
          : await api.put<AdminArticle>(`/api/admin/articles/${id}`, body)
      return data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: articlesKey })
      void queryClient.invalidateQueries({ queryKey: categoriesKey }) // nombreArticlesActifs
      refreshPublic()
    },
  })
}

type ToggleField = 'estDisponible' | 'estActif'

/**
 * Bascule rapide « disponible » (épuisé en un clic) ou « actif » : optimiste sur toutes les listes
 * d'articles en cache, retour arrière si le serveur refuse.
 */
function useToggleArticle(field: ToggleField, path: 'disponible' | 'actif') {
  const queryClient = useQueryClient()
  const refreshPublic = useRefreshPublicMenu()
  return useMutation<
    AdminArticle,
    Error,
    { id: number; value: boolean },
    { snapshots: Array<[readonly unknown[], PagedResult<AdminArticle> | undefined]> }
  >({
    mutationFn: async ({ id, value }) =>
      (await api.patch<AdminArticle>(`/api/admin/articles/${id}/${path}`, { [field]: value })).data,
    onMutate: async ({ id, value }) => {
      await queryClient.cancelQueries({ queryKey: articlesKey })
      const snapshots = queryClient.getQueriesData<PagedResult<AdminArticle>>({
        queryKey: articlesKey,
      })
      snapshots.forEach(([key, data]) => {
        if (!data) return
        queryClient.setQueryData(key, {
          ...data,
          items: data.items.map((a) => (a.id === id ? { ...a, [field]: value } : a)),
        })
      })
      return { snapshots }
    },
    onError: (_e, _vars, context) => {
      context?.snapshots.forEach(([key, data]) => queryClient.setQueryData(key, data))
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: articlesKey })
      void queryClient.invalidateQueries({ queryKey: categoriesKey })
      refreshPublic()
    },
  })
}

export const useSetArticleAvailable = () => useToggleArticle('estDisponible', 'disponible')
export const useSetArticleActive = () => useToggleArticle('estActif', 'actif')

/** Réordonne les articles d'UNE catégorie (le serveur refuse un mélange de catégories). */
export function useReorderArticles() {
  const queryClient = useQueryClient()
  const refreshPublic = useRefreshPublicMenu()
  return useMutation<AdminArticle[], Error, number[]>({
    mutationFn: async (ids) =>
      (await api.put<AdminArticle[]>('/api/admin/articles/ordre', { ids })).data,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: articlesKey })
      refreshPublic()
    },
  })
}
