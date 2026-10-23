import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import type { Panier } from '@/lib/types'
import { mockApi } from '@/test/mockApi'
import { cartKey, useAddToCart, usePanier, useRemoveItem, useSetQuantity } from './api'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: true }),
}))

const article = { id: 7, nom: 'Brik', prix: 4.5, imageUrl: null, disponible: true }

const serverCart = (quantite: number): Panier => ({
  lignes: [
    {
      articleId: 7,
      nom: 'Brik',
      prixUnitaire: 4.5,
      imageUrl: null,
      disponible: true,
      quantite,
      totalLigne: quantite * 4.5,
      avertissement: null,
    },
  ],
  nombreArticles: quantite,
  sousTotal: quantite * 4.5,
  dateMiseAJour: null,
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

describe('hooks du panier', () => {
  it('charge le panier avec ?lang=', async () => {
    mock = mockApi({ 'GET /api/panier': () => ({ data: serverCart(2) }) })
    const { wrapper } = setup()
    const { result } = renderHook(() => usePanier(), { wrapper })
    await waitFor(() => expect(result.current.data?.nombreArticles).toBe(2))
    expect(mock.calls[0]?.params).toEqual({ lang: 'fr' })
  })

  it('ajout : affichage optimiste immédiat puis valeurs du serveur', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'POST /api/panier/items': async () => {
        await gate
        return { data: serverCart(1) }
      },
      'GET /api/panier': () => ({ data: serverCart(1) }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(cartKey('fr'), { ...serverCart(0), lignes: [], nombreArticles: 0 })
    const { result } = renderHook(() => useAddToCart(), { wrapper })

    let pending: Promise<boolean> = Promise.resolve(false)
    act(() => {
      pending = result.current.add({ article })
    })
    await waitFor(() => expect(client.getQueryData<Panier>(cartKey('fr'))?.nombreArticles).toBe(1))
    release()
    await act(async () => {
      await pending
    })
    expect(client.getQueryData<Panier>(cartKey('fr'))?.sousTotal).toBe(4.5)
  })

  it('ajout : plafond 20 appliqué de façon optimiste', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'POST /api/panier/items': async () => {
        await gate
        return { data: serverCart(20) }
      },
      'GET /api/panier': () => ({ data: serverCart(20) }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(cartKey('fr'), serverCart(19))
    const { result } = renderHook(() => useAddToCart(), { wrapper })
    let pending: Promise<boolean> = Promise.resolve(false)
    act(() => {
      pending = result.current.add({ article, quantite: 5 })
    })
    await waitFor(() => expect(client.getQueryData<Panier>(cartKey('fr'))?.nombreArticles).toBe(20))
    release()
    await act(async () => {
      await pending
    })
  })

  it('ajout : retour arrière si le serveur refuse (409 indisponible)', async () => {
    mock = mockApi({
      'POST /api/panier/items': () => ({ status: 409, data: { title: 'Indisponible' } }),
      'GET /api/panier': () => ({ data: serverCart(2) }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(cartKey('fr'), serverCart(2))
    const { result } = renderHook(() => useAddToCart(), { wrapper })
    await act(async () => {
      await expect(result.current.add({ article })).rejects.toMatchObject({ status: 409 })
    })
    expect(client.getQueryData<Panier>(cartKey('fr'))?.nombreArticles).toBe(2)
  })

  it('anti double-clic : un deuxième ajout du même article en vol est ignoré', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'POST /api/panier/items': async () => {
        await gate
        return { data: serverCart(1) }
      },
      'GET /api/panier': () => ({ data: serverCart(1) }),
    })
    const { wrapper } = setup()
    const { result } = renderHook(() => useAddToCart(), { wrapper })
    let first: Promise<boolean> = Promise.resolve(false)
    let second: boolean | undefined
    act(() => {
      first = result.current.add({ article })
    })
    await act(async () => {
      second = await result.current.add({ article })
    })
    expect(second).toBe(false)
    release()
    await act(async () => {
      expect(await first).toBe(true)
    })
    expect(mock.calls.filter((c) => c.method === 'post')).toHaveLength(1)
  })

  it('quantité : PUT avec la nouvelle quantité, jamais de userId ni panierId', async () => {
    mock = mockApi({
      'PUT /api/panier/items/7': () => ({ data: serverCart(3) }),
      'GET /api/panier': () => ({ data: serverCart(3) }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(cartKey('fr'), serverCart(1))
    const { result } = renderHook(() => useSetQuantity(), { wrapper })
    await act(async () => {
      await result.current.mutateAsync({ articleId: 7, quantite: 3 })
    })
    const put = mock.calls.find((c) => c.method === 'put')
    expect(JSON.parse(String(put?.data))).toEqual({ quantite: 3 })
    expect(client.getQueryData<Panier>(cartKey('fr'))?.nombreArticles).toBe(3)
  })

  it("suppression : retour arrière en cas d'erreur réseau", async () => {
    mock = mockApi({
      'DELETE /api/panier/items/7': () => ({ status: 500, data: { title: 'boom' } }),
      'GET /api/panier': () => ({ data: serverCart(2) }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(cartKey('fr'), serverCart(2))
    const { result } = renderHook(() => useRemoveItem(), { wrapper })
    await act(async () => {
      await expect(result.current.mutateAsync({ articleId: 7 })).rejects.toBeTruthy()
    })
    expect(client.getQueryData<Panier>(cartKey('fr'))?.lignes).toHaveLength(1)
  })
})
