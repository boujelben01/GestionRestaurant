import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Restaurant } from '@/lib/types'
import {
  buildHorairesRequest,
  buildSettingsRequest,
  type DayForm,
  type SettingsFormValues,
} from './validation'

/** Les trois routes renvoient le même objet que GET /api/restaurant : on met le cache public à jour. */
function useRestaurantMutation<TVars>(request: (vars: TVars) => Promise<Restaurant>) {
  const queryClient = useQueryClient()
  return useMutation<Restaurant, Error, TVars>({
    mutationFn: request,
    onSuccess: (data) => {
      queryClient.setQueryData(['restaurant'], data)
      void queryClient.invalidateQueries({ queryKey: ['restaurant'] })
    },
  })
}

export const useSaveSettings = () =>
  useRestaurantMutation<SettingsFormValues>(
    async (values) =>
      (await api.put<Restaurant>('/api/admin/restaurant', buildSettingsRequest(values))).data,
  )

export const useSaveHoraires = () =>
  useRestaurantMutation<DayForm[]>(
    async (days) =>
      (await api.put<Restaurant>('/api/admin/restaurant/horaires', buildHorairesRequest(days)))
        .data,
  )

/** Interrupteur « Prendre des commandes » ; l'UI demande une confirmation avant de FERMER. */
export const useSetOrdersOpen = () =>
  useRestaurantMutation<boolean>(
    async (commandesOuvertes) =>
      (
        await api.patch<Restaurant>('/api/admin/restaurant/commandes-ouvertes', {
          commandesOuvertes,
        })
      ).data,
  )
