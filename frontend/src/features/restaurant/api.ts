import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Restaurant } from '@/lib/types'

export async function fetchRestaurant(): Promise<Restaurant> {
  const { data } = await api.get<Restaurant>('/api/restaurant')
  return data
}

export function useRestaurant() {
  return useQuery({
    queryKey: ['restaurant'],
    queryFn: fetchRestaurant,
    // Le statut ouvert/fermé évolue avec l'heure : on le rafraîchit chaque minute.
    staleTime: 30_000,
    refetchInterval: 60_000,
  })
}
