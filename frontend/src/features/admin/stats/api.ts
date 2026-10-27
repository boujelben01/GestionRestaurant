import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useAuth } from '@/features/auth/AuthContext'
import { api } from '@/lib/api'
import type { Breakdown, PeakHour, SalesDay, StatsResume, TopArticle } from '@/lib/types'
import type { Period } from './period'

export const STATS_POLL_MS = 60_000
const ROOT = ['private', 'admin', 'stats'] as const

/**
 * Les cinq lectures du tableau de bord : même période, rafraîchies toutes les 60 s (suspendu onglet masqué,
 * relancé au retour). `keepPreviousData` garde l'affichage précédent pendant un changement de période, pour
 * éviter un clignotement de squelettes.
 */
function useStats<T>(route: string, period: Period, extra: Record<string, string | number> = {}) {
  const { isAuthenticated, hasRole } = useAuth()
  const params = { du: period.du, au: period.au, ...extra }
  return useQuery({
    queryKey: [...ROOT, route, params],
    enabled: isAuthenticated && hasRole('Admin'),
    queryFn: async () => (await api.get<T>(`/api/admin/statistiques/${route}`, { params })).data,
    refetchInterval: STATS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  })
}

export const useStatsResume = (period: Period) => useStats<StatsResume>('resume', period)
export const useSalesByDay = (period: Period) => useStats<SalesDay[]>('ventes-par-jour', period)
export const usePeakHours = (period: Period) => useStats<PeakHour[]>('heures-de-pointe', period)

/** Top des articles (noms copiés sur les lignes), 10 par défaut, 20 au plus. */
export function useTopArticles(period: Period, limite = 10) {
  return useStats<TopArticle[]>('top-articles', period, { limite })
}

export function useBreakdown(period: Period) {
  return useStats<Breakdown>('repartition', period)
}
