import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ActiveOrder, AdminOrder } from '@/lib/types'
import { mockApi } from '@/test/mockApi'
import {
  EMPTY_FILTERS,
  activeOrdersKey,
  filtersToParams,
  useActiveOrders,
  useChangeOrderStatus,
  useSetOrderPaid,
} from './api'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, hasRole: (r: string) => r === 'Admin' }),
}))

const active = (id: number, statut: ActiveOrder['statut'], version = 10): ActiveOrder => ({
  id,
  numero: `CMD-${id}`,
  statut,
  typeCommande: 'ARemporter',
  nomClient: 'Sami',
  tableNumero: null,
  note: null,
  dateCommande: '2024-06-01T10:00:00Z',
  dateMiseAJour: '2024-06-01T10:00:00Z',
  lignes: [],
  version,
})

const detail = (
  id: number,
  statut: AdminOrder['statut'],
  version: number,
  over: Partial<AdminOrder> = {},
): AdminOrder => ({
  id,
  numero: `CMD-${id}`,
  statut,
  statutsSuivants: [],
  typeCommande: 'ARemporter',
  modePaiement: 'Especes',
  estPayee: false,
  sousTotal: 9,
  fraisLivraison: 0,
  total: 9,
  note: null,
  adresseLivraison: null,
  tableNumero: null,
  client: { userId: 'u1', nom: 'Sami', telephone: '+21620123456' },
  dateCommande: '2024-06-01T10:00:00Z',
  dateMiseAJour: '2024-06-01T10:05:00Z',
  lignes: [],
  historique: [],
  version,
  ...over,
})

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

let mock: ReturnType<typeof mockApi> | undefined
afterEach(() => mock?.restore())

describe('useChangeOrderStatus', () => {
  it('envoie la version lue et déplace la carte de façon optimiste', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'PATCH /api/admin/commandes/1/statut': async () => {
        await gate
        return { data: detail(1, 'EnPreparation', 11) }
      },
      'GET /api/admin/commandes/actives': () => ({ data: [active(1, 'EnPreparation', 11)] }),
      'GET /api/admin/commandes/compteurs': () => ({ data: {} }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(activeOrdersKey, [active(1, 'EnAttente'), active(2, 'EnAttente')])
    const { result } = renderHook(() => useChangeOrderStatus(), { wrapper })

    let done: Promise<unknown> = Promise.resolve()
    act(() => {
      done = result.current.mutateAsync({ order: { id: 1, version: 10 }, statut: 'EnPreparation' })
    })
    // Avant la réponse du serveur : la carte a déjà changé de colonne.
    await waitFor(() =>
      expect(
        client.getQueryData<ActiveOrder[]>(activeOrdersKey)?.find((o) => o.id === 1)?.statut,
      ).toBe('EnPreparation'),
    )
    release()
    await act(async () => {
      await done
    })

    const patch = mock.calls.find((c) => c.method === 'patch')
    expect(JSON.parse(String(patch?.data))).toEqual({ statut: 'EnPreparation', version: 10 })
  })

  it("Terminee ou Annulee : la carte quitte immédiatement l'écran", async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'PATCH /api/admin/commandes/1/statut': async () => {
        await gate
        return { data: detail(1, 'Annulee', 12) }
      },
      'GET /api/admin/commandes/actives': () => ({ data: [active(2, 'EnAttente')] }),
      'GET /api/admin/commandes/compteurs': () => ({ data: {} }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(activeOrdersKey, [active(1, 'Prete'), active(2, 'EnAttente')])
    const { result } = renderHook(() => useChangeOrderStatus(), { wrapper })

    let done: Promise<unknown> = Promise.resolve()
    act(() => {
      done = result.current.mutateAsync({ order: { id: 1, version: 10 }, statut: 'Annulee' })
    })
    await waitFor(() => expect(client.getQueryData<ActiveOrder[]>(activeOrdersKey)).toHaveLength(1))
    release()
    await act(async () => {
      await done
    })
  })

  it('409 (modifiée entre-temps) : retour arrière puis rechargement depuis le serveur', async () => {
    let server = [active(1, 'EnAttente'), active(2, 'EnAttente')]
    mock = mockApi({
      'PATCH /api/admin/commandes/1/statut': () => {
        // Un autre admin a pris la commande entre-temps : le serveur est la source de vérité.
        server = [active(1, 'EnPreparation', 11), active(2, 'EnAttente')]
        return {
          status: 409,
          data: { title: 'La commande a été modifiée entre-temps. Rechargez-la et réessayez.' },
        }
      },
      'GET /api/admin/commandes/actives': () => ({ data: server }),
      'GET /api/admin/commandes/compteurs': () => ({ data: {} }),
    })
    const { wrapper } = setup()
    // L'écran des commandes est monté : la liste a un observateur qui se recharge.
    const { result } = renderHook(
      () => ({ change: useChangeOrderStatus(), board: useActiveOrders() }),
      { wrapper },
    )
    await waitFor(() => expect(result.current.board.data).toHaveLength(2))

    await act(async () => {
      await expect(
        result.current.change.mutateAsync({
          order: { id: 1, version: 10 },
          statut: 'EnPreparation',
        }),
      ).rejects.toMatchObject({ status: 409 })
    })

    await waitFor(() =>
      expect(result.current.board.data?.find((o) => o.id === 1)?.version).toBe(11),
    )
    expect(result.current.board.data?.find((o) => o.id === 1)?.statut).toBe('EnPreparation')
  })

  it("409 transition interdite : l'état optimiste est annulé avant le rechargement", async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'PATCH /api/admin/commandes/1/statut': async () => {
        await gate
        return { status: 409, data: { title: "EnAttente -> Terminee n'est pas autorisé." } }
      },
      'GET /api/admin/commandes/actives': () => ({ data: [active(1, 'EnAttente')] }),
      'GET /api/admin/commandes/compteurs': () => ({ data: {} }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(activeOrdersKey, [active(1, 'EnAttente')])
    const { result } = renderHook(() => useChangeOrderStatus(), { wrapper })

    let outcome: Promise<unknown> = Promise.resolve()
    act(() => {
      outcome = result.current
        .mutateAsync({ order: { id: 1, version: 10 }, statut: 'Terminee' })
        .catch((e: unknown) => e)
    })
    await waitFor(() => expect(client.getQueryData<ActiveOrder[]>(activeOrdersKey)).toHaveLength(0)) // optimiste
    release()
    await act(async () => {
      expect(await outcome).toMatchObject({ status: 409 })
    })
    await waitFor(() => expect(client.getQueryData<ActiveOrder[]>(activeOrdersKey)).toHaveLength(1)) // restauré
  })
})

describe('useSetOrderPaid', () => {
  it('marque payée de façon optimiste et revient en arrière en cas de refus', async () => {
    mock = mockApi({
      'PATCH /api/admin/commandes/7/paiement': () => ({ status: 409, data: { title: 'Annulée' } }),
      'GET /api/admin/commandes/7': () => ({ data: detail(7, 'EnAttente', 3) }),
      'GET /api/admin/commandes/actives': () => ({ data: [] }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(['private', 'admin', 'orders', 'detail', 7, 3], detail(7, 'EnAttente', 3))
    const { result } = renderHook(() => useSetOrderPaid(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync({ id: 7, estPayee: true })).rejects.toMatchObject({
        status: 409,
      })
    })
    expect(
      client.getQueryData<AdminOrder>(['private', 'admin', 'orders', 'detail', 7, 3])?.estPayee,
    ).toBe(false)
  })
})

describe('useActiveOrders', () => {
  it('interroge GET /actives (polling configuré à 10 s)', async () => {
    mock = mockApi({
      'GET /api/admin/commandes/actives': () => ({ data: [active(1, 'EnAttente')] }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useActiveOrders(), { wrapper })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
  })
})

describe('filtersToParams', () => {
  it("n'envoie que les filtres renseignés, statuts séparés par des virgules", () => {
    expect(filtersToParams(EMPTY_FILTERS, 1, 20)).toEqual({ page: 1, pageSize: 20 })
    expect(
      filtersToParams(
        {
          statut: ['EnAttente', 'Prete'],
          typeCommande: 'Livraison',
          estPayee: false,
          du: '2024-06-01',
          au: '',
          recherche: ' sami ',
        },
        2,
        10,
      ),
    ).toEqual({
      page: 2,
      pageSize: 10,
      statut: 'EnAttente,Prete',
      typeCommande: 'Livraison',
      estPayee: false,
      du: '2024-06-01',
      recherche: 'sami',
    })
  })
})
