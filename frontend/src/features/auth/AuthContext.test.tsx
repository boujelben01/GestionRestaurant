import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from '@/lib/tokenStore'
import type { LoginResponse, User } from '@/lib/types'
import { mockApi, networkError } from '@/test/mockApi'
import { AuthProvider, useAuth } from './AuthContext'

const user: User = {
  id: 'u1',
  userName: 'yazid',
  nom: 'Yazid',
  email: 'client@example.com',
  telephone: null,
  roles: ['Client'],
  langueFavorite: 'fr',
}

const inOneHour = () => new Date(Date.now() + 3_600_000).toISOString()
const loginResponse = (overrides: Partial<LoginResponse> = {}): LoginResponse => ({
  token: 'jwt-token',
  expiresAtUtc: inOneHour(),
  user,
  ...overrides,
})

function Probe() {
  const { status, user, login, logout, hasRole } = useAuth()
  return (
    <div>
      <p data-testid="status">{status}</p>
      <p data-testid="name">{user?.nom ?? '-'}</p>
      <p data-testid="admin">{String(hasRole('Admin'))}</p>
      <button
        onClick={() =>
          login({ identifiant: 'client@example.com', password: 'secret123' }).catch(() => {})
        }
      >
        login
      </button>
      <button onClick={logout}>logout</button>
    </div>
  )
}

function renderAuth(onSessionEnded = vi.fn(), ui: ReactNode = <Probe />) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <AuthProvider onSessionEnded={onSessionEnded}>{ui}</AuthProvider>
    </QueryClientProvider>,
  )
  return { onSessionEnded }
}

let mock: ReturnType<typeof mockApi> | undefined
afterEach(() => mock?.restore())

describe('AuthContext', () => {
  beforeEach(() => localStorage.clear())

  it('démarre anonyme sans jeton', () => {
    mock = mockApi({})
    renderAuth()
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    expect(mock.calls).toHaveLength(0)
  })

  it('login : stocke le jeton, lit le profil et les rôles', async () => {
    mock = mockApi({
      'POST /api/auth/login': () => ({ data: loginResponse() }),
    })
    renderAuth()
    await userEvent.click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('name')).toHaveTextContent('Yazid')
    expect(screen.getByTestId('admin')).toHaveTextContent('false')
    expect(tokenStore.get()).toBe('jwt-token')
  })

  it('envoie le jeton en Bearer sur les requêtes suivantes', async () => {
    mock = mockApi({
      'POST /api/auth/login': () => ({ data: loginResponse() }),
      'GET /api/auth/me': () => ({ data: user }),
    })
    renderAuth()
    await userEvent.click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    const { api } = await import('@/lib/api')
    await api.get('/api/auth/me')
    const last = mock.calls.at(-1)!
    expect(last.headers.get('Authorization')).toBe('Bearer jwt-token')
  })

  it('identifiants invalides (401 de /login) : reste anonyme, pas de redirection forcée', async () => {
    mock = mockApi({
      'POST /api/auth/login': () => ({ status: 401, data: { title: 'Identifiants invalides.' } }),
    })
    const { onSessionEnded } = renderAuth()
    await userEvent.click(screen.getByText('login'))
    await waitFor(() => expect(mock!.calls).toHaveLength(1))
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    expect(onSessionEnded).not.toHaveBeenCalled()
  })

  it('recharge le profil au démarrage avec un jeton valide', async () => {
    tokenStore.set('jwt-token', inOneHour())
    mock = mockApi({ 'GET /api/auth/me': () => ({ data: { ...user, roles: ['Admin'] } }) })
    renderAuth()
    expect(screen.getByTestId('status')).toHaveTextContent('loading')
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    expect(screen.getByTestId('admin')).toHaveTextContent('true')
  })

  it('401 au rechargement du profil : déconnexion propre et redirection', async () => {
    tokenStore.set('revoked', inOneHour())
    mock = mockApi({ 'GET /api/auth/me': () => ({ status: 401, data: { title: 'Non autorisé' } }) })
    const { onSessionEnded } = renderAuth()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(tokenStore.get()).toBeNull()
    expect(onSessionEnded).toHaveBeenCalledTimes(1)
  })

  it('jeton expiré au démarrage : anonyme, jeton purgé, aucun appel réseau', async () => {
    tokenStore.set('old', new Date(Date.now() - 1000).toISOString())
    mock = mockApi({})
    renderAuth()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(tokenStore.get()).toBeNull()
    expect(mock.calls).toHaveLength(0)
  })

  it('panne réseau au démarrage : anonyme mais jeton conservé', async () => {
    tokenStore.set('jwt-token', inOneHour())
    mock = mockApi({ 'GET /api/auth/me': networkError() })
    renderAuth()
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'))
    expect(tokenStore.get()).toBe('jwt-token')
  })

  it('termine la session quand le jeton arrive à expiration', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      mock = mockApi({
        'POST /api/auth/login': () => ({
          data: loginResponse({ expiresAtUtc: new Date(Date.now() + 5000).toISOString() }),
        }),
      })
      const { onSessionEnded } = renderAuth()
      await userEvent.click(screen.getByText('login'))
      await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6000)
      })
      expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
      expect(tokenStore.get()).toBeNull()
      expect(onSessionEnded).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('logout vide la session et le jeton', async () => {
    mock = mockApi({ 'POST /api/auth/login': () => ({ data: loginResponse() }) })
    renderAuth()
    await userEvent.click(screen.getByText('login'))
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'))
    await userEvent.click(screen.getByText('logout'))
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous')
    expect(tokenStore.get()).toBeNull()
  })
})
