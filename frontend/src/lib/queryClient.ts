import { QueryClient } from '@tanstack/react-query'
import { isAppError } from './errors'

/** Pas de nouvelle tentative sur les 4xx (inutile) ; 2 tentatives max sinon (réseau, 5xx). */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (isAppError(error) && error.status !== null && error.status >= 400 && error.status < 500) {
    return false
  }
  return failureCount < 2
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Le menu est mis en cache 60 s côté serveur : inutile de re-télécharger avant.
        staleTime: 60_000,
        gcTime: 10 * 60_000,
        retry: shouldRetry,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  })
}
