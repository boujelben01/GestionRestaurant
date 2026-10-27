import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import '@/lib/i18n'
import { mockApi } from '@/test/mockApi'
import {
  favoriteIdsKey,
  useCustomerFeatures,
  useFavoriteIds,
  useToggleFavorite,
  withFavorite,
} from './api'

const auth = vi.hoisted(() => ({ value: { isAuthenticated: true, roles: ['Client'] as string[] } }))
vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: auth.value.isAuthenticated,
    hasRole: (r: string) => auth.value.roles.includes(r),
  }),
}))

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
  auth.value = { isAuthenticated: true, roles: ['Client'] }
})

describe('withFavorite', () => {
  it('ajoute en tête sans doublon et retire', () => {
    expect(withFavorite([3, 2], 5, true)).toEqual([5, 3, 2])
    expect(withFavorite([3, 2], 2, true)).toEqual([2, 3])
    expect(withFavorite([3, 2], 3, false)).toEqual([2])
    expect(withFavorite([3, 2], 9, false)).toEqual([3, 2])
  })
})

describe('réservé aux clients', () => {
  it('un client connecté y a droit', () => {
    const { wrapper } = setup()
    expect(renderHook(() => useCustomerFeatures(), { wrapper }).result.current).toBe(true)
  })

  it('ni un invité ni un administrateur', () => {
    const { wrapper } = setup()
    auth.value = { isAuthenticated: false, roles: [] }
    expect(renderHook(() => useCustomerFeatures(), { wrapper }).result.current).toBe(false)
    auth.value = { isAuthenticated: true, roles: ['Admin'] }
    expect(renderHook(() => useCustomerFeatures(), { wrapper }).result.current).toBe(false)
  })

  it('un administrateur ne déclenche aucune requête de favoris', async () => {
    auth.value = { isAuthenticated: true, roles: ['Admin'] }
    mock = mockApi({})
    const { wrapper } = setup()
    renderHook(() => useFavoriteIds(), { wrapper })
    await new Promise((r) => setTimeout(r, 50))
    expect(mock.calls).toHaveLength(0)
  })
})

describe('useToggleFavorite', () => {
  it('ajout : le cœur change tout de suite puis le serveur confirme', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'PUT /api/favoris/7': async () => {
        await gate
        return { status: 204 }
      },
      'GET /api/favoris/ids': () => ({ data: [7, 3] }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(favoriteIdsKey, [3])
    const { result } = renderHook(() => useToggleFavorite(), { wrapper })

    let done: Promise<boolean> = Promise.resolve(false)
    act(() => {
      done = result.current.toggle(7, true)
    })
    await waitFor(() => expect(client.getQueryData<number[]>(favoriteIdsKey)).toEqual([7, 3]))
    release()
    await act(async () => {
      expect(await done).toBe(true)
    })
  })

  it('retrait : DELETE envoyé et cœur retiré', async () => {
    mock = mockApi({
      'DELETE /api/favoris/3': () => ({ status: 204 }),
      'GET /api/favoris/ids': () => ({ data: [] }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(favoriteIdsKey, [3])
    const { result } = renderHook(() => useToggleFavorite(), { wrapper })

    await act(async () => {
      await result.current.toggle(3, false)
    })

    expect(mock.calls.some((c) => c.method === 'delete' && c.url === '/api/favoris/3')).toBe(true)
    await waitFor(() => expect(client.getQueryData<number[]>(favoriteIdsKey)).toEqual([]))
  })

  it('refus du serveur (404 article devenu inactif) : retour arrière du cœur', async () => {
    mock = mockApi({
      'PUT /api/favoris/9': () => ({ status: 404, data: { title: 'Article introuvable.' } }),
      'GET /api/favoris/ids': () => ({ data: [3] }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(favoriteIdsKey, [3])
    const { result } = renderHook(() => useToggleFavorite(), { wrapper })

    await act(async () => {
      await expect(result.current.toggle(9, true)).rejects.toMatchObject({ status: 404 })
    })

    await waitFor(() => expect(client.getQueryData<number[]>(favoriteIdsKey)).toEqual([3]))
  })

  it('un second clic sur le même article pendant la requête est ignoré', async () => {
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    mock = mockApi({
      'PUT /api/favoris/7': async () => {
        await gate
        return { status: 204 }
      },
      'GET /api/favoris/ids': () => ({ data: [7] }),
    })
    const { client, wrapper } = setup()
    client.setQueryData(favoriteIdsKey, [])
    const { result } = renderHook(() => useToggleFavorite(), { wrapper })

    let first: Promise<boolean> = Promise.resolve(false)
    act(() => {
      first = result.current.toggle(7, true)
    })
    let second: boolean | undefined
    await act(async () => {
      second = await result.current.toggle(7, false)
    })
    expect(second).toBe(false)
    release()
    await act(async () => {
      await first
    })
    expect(mock.calls.filter((c) => c.url === '/api/favoris/7')).toHaveLength(1)
  })
})
