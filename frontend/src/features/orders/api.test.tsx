import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import type { Commande, Panier, Restaurant } from '@/lib/types'
import { mockApi } from '@/test/mockApi'
import { OrderError } from './checkout'
import { useCancelOrder, useCreateOrder, useOrder, useOrders } from './api'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

const order = (over: Partial<Commande> = {}): Commande => ({
  id: 12,
  numero: 'CMD-000012',
  statut: 'EnAttente',
  typeCommande: 'ARemporter',
  modePaiement: 'Especes',
  estPayee: false,
  sousTotal: 9,
  fraisLivraison: 0,
  total: 9,
  note: null,
  adresseLivraison: null,
  tableNumero: null,
  dateCommande: '2024-06-01T10:00:00Z',
  lignes: [],
  historique: [{ statut: 'EnAttente', date: '2024-06-01T10:00:00Z' }],
  ...over,
})

const emptyCart: Panier = { lignes: [], nombreArticles: 0, sousTotal: 0, dateMiseAJour: null }
const openRestaurant = { commandesOuvertes: true, ouvertMaintenant: true } as Restaurant

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  )
  return { client, wrapper }
}

let mock: ReturnType<typeof mockApi> | undefined
afterEach(() => {
  mock?.restore()
  vi.useRealTimers()
})

describe('useCreateOrder', () => {
  it('succès : renvoie la commande et invalide le panier', async () => {
    mock = mockApi({ 'POST /api/commandes': () => ({ status: 201, data: order() }) })
    const { client, wrapper } = setup()
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useCreateOrder(), { wrapper })
    let created: Commande | undefined
    await act(async () => {
      created = await result.current.mutateAsync({
        typeCommande: 'ARemporter',
        telephone: '20123456',
      })
    })
    expect(created?.numero).toBe('CMD-000012')
    expect(spy).toHaveBeenCalledWith({ queryKey: ['private', 'cart'] })
  })

  it('400 panier vide -> kind "empty"', async () => {
    mock = mockApi({
      'POST /api/commandes': () => ({
        status: 400,
        data: { errors: { Panier: ['Votre panier est vide.'] } },
      }),
      'GET /api/panier': () => ({ data: emptyCart }),
      'GET /api/restaurant': () => ({ data: openRestaurant }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useCreateOrder(), { wrapper })
    await act(async () => {
      await result.current
        .mutateAsync({ typeCommande: 'ARemporter', telephone: '20123456' })
        .catch(() => {})
    })
    const error = result.current.error as OrderError
    expect(error).toBeInstanceOf(OrderError)
    expect(error.failure.kind).toBe('empty')
  })

  it('409 restaurant fermé -> kind "closed" (d\'après /api/restaurant)', async () => {
    mock = mockApi({
      'POST /api/commandes': () => ({
        status: 409,
        data: { title: 'Le restaurant est actuellement fermé.' },
      }),
      'GET /api/panier': () => ({
        data: {
          ...emptyCart,
          lignes: [
            {
              articleId: 1,
              nom: 'x',
              prixUnitaire: 1,
              imageUrl: null,
              disponible: true,
              quantite: 1,
              totalLigne: 1,
              avertissement: null,
            },
          ],
        },
      }),
      'GET /api/restaurant': () => ({ data: { ...openRestaurant, ouvertMaintenant: false } }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useCreateOrder(), { wrapper })
    await act(async () => {
      await result.current
        .mutateAsync({ typeCommande: 'ARemporter', telephone: '20123456' })
        .catch(() => {})
    })
    expect((result.current.error as OrderError).failure.kind).toBe('closed')
  })

  it('409 articles indisponibles -> kind "unavailable"', async () => {
    mock = mockApi({
      'POST /api/commandes': () => ({
        status: 409,
        data: { title: 'Ces articles ne sont plus disponibles' },
      }),
      'GET /api/panier': () => ({
        data: {
          ...emptyCart,
          lignes: [
            {
              articleId: 1,
              nom: 'x',
              prixUnitaire: 1,
              imageUrl: null,
              disponible: false,
              quantite: 1,
              totalLigne: 1,
              avertissement: 'indisponible',
            },
          ],
        },
      }),
      'GET /api/restaurant': () => ({ data: openRestaurant }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useCreateOrder(), { wrapper })
    await act(async () => {
      await result.current
        .mutateAsync({ typeCommande: 'ARemporter', telephone: '20123456' })
        .catch(() => {})
    })
    expect((result.current.error as OrderError).failure.kind).toBe('unavailable')
  })

  it('400 par champ -> kind "fields" avec les messages serveur', async () => {
    mock = mockApi({
      'POST /api/commandes': () => ({
        status: 400,
        data: { errors: { TableCode: ['Table inconnue ou inactive.'] } },
      }),
      'GET /api/panier': () => ({ data: emptyCart }),
      'GET /api/restaurant': () => ({ data: openRestaurant }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useCreateOrder(), { wrapper })
    await act(async () => {
      await result.current
        .mutateAsync({ typeCommande: 'SurPlace', telephone: '20123456', tableCode: 'x' })
        .catch(() => {})
    })
    const failure = (result.current.error as OrderError).failure
    expect(failure.kind).toBe('fields')
    expect(failure.fields.tableCode).toBe('Table inconnue ou inactive.')
  })
})

describe('useOrder : polling', () => {
  it("relit toutes les 15 s tant que non final, puis s'arrête à Terminee", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let statut: Commande['statut'] = 'EnAttente'
    mock = mockApi({ 'GET /api/commandes/12': () => ({ data: order({ statut }) }) })
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrder(12), { wrapper })
    await waitFor(() => expect(result.current.data?.statut).toBe('EnAttente'))
    const calls = () => mock!.calls.filter((c) => c.url === '/api/commandes/12').length
    expect(calls()).toBe(1)

    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100)
    })
    expect(calls()).toBe(2)

    statut = 'Terminee'
    await act(async () => {
      await vi.advanceTimersByTimeAsync(15_100)
    })
    await waitFor(() => expect(result.current.data?.statut).toBe('Terminee'))
    const afterFinal = calls()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(calls()).toBe(afterFinal) // plus aucun appel
  })

  it("404 (commande d'autrui ou inconnue) : erreur typée sans nouvel essai", async () => {
    mock = mockApi({
      'GET /api/commandes/99': () => ({ status: 404, data: { title: 'Commande introuvable.' } }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrder(99), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as unknown as { status: number }).status).toBe(404)
  })
})

describe('useCancelOrder', () => {
  it('succès : met à jour le détail en cache', async () => {
    mock = mockApi({
      'POST /api/commandes/12/annuler': () => ({ data: order({ statut: 'Annulee' }) }),
    })
    const { client, wrapper } = setup()
    const { result } = renderHook(() => useCancelOrder(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(12)
    })
    expect(client.getQueryData<Commande>(['private', 'order', 12])?.statut).toBe('Annulee')
  })

  it('409 : recharge le détail pour afficher le vrai statut', async () => {
    mock = mockApi({
      'POST /api/commandes/12/annuler': () => ({
        status: 409,
        data: { title: 'Seule une commande en attente' },
      }),
      'GET /api/commandes/12': () => ({ data: order({ statut: 'EnPreparation' }) }),
    })
    const { client, wrapper } = setup()
    const detail = renderHook(() => useOrder(12), { wrapper })
    await waitFor(() => expect(detail.result.current.data?.statut).toBe('EnPreparation'))
    const { result } = renderHook(() => useCancelOrder(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync(12).catch(() => {})
    })
    await waitFor(() =>
      expect((result.current.error as unknown as { status: number } | null)?.status).toBe(409),
    )
    await waitFor(() =>
      expect(client.getQueryData<Commande>(['private', 'order', 12])?.statut).toBe('EnPreparation'),
    )
  })
})

describe('useOrders : pagination « Charger plus »', () => {
  it("enchaîne les pages jusqu'à épuisement du total", async () => {
    const page = (p: number) => ({
      items: [
        {
          id: p,
          numero: `CMD-${p}`,
          statut: 'Terminee',
          typeCommande: 'ARemporter',
          total: 5,
          nombreArticles: 1,
          dateCommande: '2024-06-01T10:00:00Z',
        },
      ],
      page: p,
      pageSize: 1,
      total: 2,
    })
    mock = mockApi({
      'GET /api/commandes': (config) => ({
        data: page(Number((config.params as { page: number }).page)),
      }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useOrders(), { wrapper })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(1))
    expect(result.current.hasNextPage).toBe(true)
    await act(async () => {
      await result.current.fetchNextPage()
    })
    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2))
    expect(result.current.hasNextPage).toBe(false)
  })
})
