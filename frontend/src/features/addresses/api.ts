import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useCustomerFeatures } from '@/features/favorites/api'
import { api } from '@/lib/api'
import type { Address } from '@/lib/types'
import { applyDefault, buildAddressRequest, type AddressFormValues } from './rules'

export const addressesKey = ['private', 'addresses'] as const

/** Carnet d'adresses du client (la défaut d'abord) ; désactivé pour un invité ou un administrateur. */
export function useAddresses() {
  const enabled = useCustomerFeatures()
  return useQuery({
    queryKey: addressesKey,
    enabled,
    queryFn: async () => (await api.get<Address[]>('/api/adresses')).data,
    staleTime: 30_000,
  })
}

function useAddressMutation<TVars>(request: (vars: TVars) => Promise<unknown>) {
  const queryClient = useQueryClient()
  return useMutation<unknown, Error, TVars>({
    mutationFn: request,
    // Le serveur fait foi (adresse par défaut recalculée, 10 au plus) : on recharge toujours la liste.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: addressesKey }),
  })
}

/** Création : un 409 signifie que la limite de 10 adresses est atteinte. */
export const useCreateAddress = () =>
  useAddressMutation<AddressFormValues>(
    async (values) => (await api.post<Address>('/api/adresses', buildAddressRequest(values))).data,
  )

export const useUpdateAddress = () =>
  useAddressMutation<{ id: number; values: AddressFormValues }>(
    async ({ id, values }) =>
      (await api.put<Address>(`/api/adresses/${id}`, buildAddressRequest(values))).data,
  )

/** Suppression RÉELLE (donnée personnelle) ; si c'était la défaut, la plus ancienne restante la devient. */
export const useDeleteAddress = () =>
  useAddressMutation<{ id: number }>(async ({ id }) => api.delete(`/api/adresses/${id}`))

/** « Définir par défaut » : optimiste (la défaut passe en premier), retour arrière si le serveur refuse. */
export function useSetDefaultAddress() {
  const queryClient = useQueryClient()
  return useMutation<Address, Error, { id: number }, { previous: Address[] | undefined }>({
    mutationFn: async ({ id }) => (await api.patch<Address>(`/api/adresses/${id}/defaut`)).data,
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: addressesKey })
      const previous = queryClient.getQueryData<Address[]>(addressesKey)
      queryClient.setQueryData<Address[]>(addressesKey, (list) =>
        list ? applyDefault(list, id) : list,
      )
      return { previous }
    },
    onError: (_error, _vars, context) => {
      if (context) queryClient.setQueryData(addressesKey, context.previous)
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: addressesKey }),
  })
}
