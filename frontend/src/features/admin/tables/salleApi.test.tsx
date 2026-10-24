import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SalleOrder, SalleTable } from '@/lib/types'
import { mockApi } from '@/test/mockApi'
import { salleKey, useCollectTable, useReleaseTable, useSalle } from './salleApi'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true, hasRole: (r: string) => r === 'Admin' }),
}))

const order = (id: number, statut: SalleOrder['statut'], estPayee = false): SalleOrder => ({
  id,
  numero: `CMD-${id}`,
  statut,
  total: 7,
  estPayee,
  dateCommande: '2024-06-01T10:00:00Z',
})

const table = (commandes: SalleOrder[], etat: SalleTable['etat']): SalleTable => ({
  id: 5,
  numero: 5,
  capacite: 4,
  estActive: true,
  etat,
  totalAEncaisser: commandes.filter((c) => !c.estPayee).reduce((n, c) => n + c.total, 0),
  nombreCommandes: commandes.length,
  premiereCommandeUtc: commandes[0]?.dateCommande ?? null,
  commandes,
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

describe('plan de salle : relevé', () => {
  it('interroge GET /api/admin/tables/salle', async () => {
    mock = mockApi({ 'GET /api/admin/tables/salle': () => ({ data: [table([], 'Libre')] }) })
    const { wrapper } = setup()
    const { result } = renderHook(() => useSalle(), { wrapper })

    await waitFor(() => expect(result.current.data).toHaveLength(1))
  })
})

describe('encaisser', () => {
  it('met la table à jour de façon optimiste puis adopte la réponse du serveur', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    const paid = table([order(1, 'EnPreparation', true)], 'Occupee')
    mock = mockApi({
      'POST /api/admin/tables/5/encaisser': async () => {
        await gate
        return { data: paid }
      },
      'GET /api/admin/tables/salle': () => ({ data: [paid] }),
      'GET /api/admin/commandes/actives': () => ({ data: [] }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(salleKey, [table([order(1, 'EnPreparation')], 'Occupee')])
    const { result } = renderHook(() => useCollectTable(), { wrapper })

    let done: Promise<unknown> = Promise.resolve()
    act(() => {
      done = result.current.mutateAsync({ id: 5 })
    })
    await waitFor(() =>
      expect(client.getQueryData<SalleTable[]>(salleKey)?.[0]?.totalAEncaisser).toBe(0),
    )
    release()
    await act(async () => {
      await done
    })
  })

  it('409 (rien à encaisser) : retour arrière puis rechargement', async () => {
    const before = table([order(1, 'Prete')], 'Occupee')
    mock = mockApi({
      'POST /api/admin/tables/5/encaisser': () => ({
        status: 409,
        data: { title: "La table n° 5 n'a rien à encaisser." },
      }),
      'GET /api/admin/tables/salle': () => ({ data: [before] }),
    })
    const { client, wrapper } = setup()
    const both = renderHook(() => ({ salle: useSalle(), collect: useCollectTable() }), { wrapper })
    await waitFor(() => expect(both.result.current.salle.data).toHaveLength(1))

    await act(async () => {
      await expect(both.result.current.collect.mutateAsync({ id: 5 })).rejects.toMatchObject({
        status: 409,
      })
    })

    await waitFor(() =>
      expect(client.getQueryData<SalleTable[]>(salleKey)?.[0]?.totalAEncaisser).toBe(7),
    )
  })
})

describe('libérer', () => {
  it('succès : la table devient libre', async () => {
    const free = table([], 'Libre')
    mock = mockApi({
      'POST /api/admin/tables/5/liberer': () => ({ data: free }),
      'GET /api/admin/tables/salle': () => ({ data: [free] }),
      'GET /api/admin/commandes/actives': () => ({ data: [] }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(salleKey, [table([order(1, 'Prete', true)], 'Occupee')])
    const { result } = renderHook(() => useReleaseTable(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: 5 })
    })

    expect(client.getQueryData<SalleTable[]>(salleKey)?.[0]?.etat).toBe('Libre')
  })

  it('409 : message du serveur conservé, état précédent restauré', async () => {
    const cooking = table([order(1, 'EnPreparation')], 'Occupee')
    mock = mockApi({
      'POST /api/admin/tables/5/liberer': () => ({
        status: 409,
        data: {
          title:
            "Impossible de libérer la table n° 5 : 1 commande(s) en attente ou en préparation (terminez-les ou annulez-les d'abord).",
        },
      }),
      'GET /api/admin/tables/salle': () => ({ data: [cooking] }),
    })
    const { client, wrapper } = setup()
    const both = renderHook(() => ({ salle: useSalle(), release: useReleaseTable() }), { wrapper })
    await waitFor(() => expect(both.result.current.salle.data).toHaveLength(1))

    let error: unknown
    await act(async () => {
      error = await both.result.current.release.mutateAsync({ id: 5 }).catch((e: unknown) => e)
    })

    expect(error).toMatchObject({ status: 409 })
    expect((error as Error).message).toContain('en attente ou en préparation')
    await waitFor(() =>
      expect(client.getQueryData<SalleTable[]>(salleKey)?.[0]?.etat).toBe('Occupee'),
    )
  })
})
