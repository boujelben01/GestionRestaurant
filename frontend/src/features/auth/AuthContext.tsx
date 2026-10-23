import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { api, setUnauthorizedHandler } from '@/lib/api'
import { tokenStore } from '@/lib/tokenStore'
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '@/lib/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  user: User | null
  status: AuthStatus
  isAuthenticated: boolean
  hasRole: (role: string) => boolean
  login: (credentials: LoginRequest) => Promise<User>
  /** Crée le compte puis ouvre la session (l'API renvoie 201 sans jeton). */
  register: (data: RegisterRequest) => Promise<User>
  logout: () => void
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
  /** Appelé après une déconnexion forcée (401 / jeton expiré). Reçoit la route de connexion. */
  onSessionEnded?: () => void
}

export function AuthProvider({ children, onSessionEnded }: AuthProviderProps) {
  const queryClient = useQueryClient()
  const [user, setUser] = useState<User | null>(null)
  const [status, setStatus] = useState<AuthStatus>(() =>
    tokenStore.isValid() ? 'loading' : 'anonymous',
  )
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const sessionEndedRef = useRef(onSessionEnded)
  useEffect(() => {
    sessionEndedRef.current = onSessionEnded
  })

  const clearSession = useCallback(() => {
    clearTimeout(expiryTimer.current)
    tokenStore.clear()
    setUser(null)
    setStatus('anonymous')
    // Les données privées (panier, commandes) ne doivent pas survivre à la session.
    queryClient.removeQueries({ queryKey: ['private'] })
  }, [queryClient])

  const endSession = useCallback(() => {
    clearSession()
    sessionEndedRef.current?.()
  }, [clearSession])

  const scheduleExpiry = useCallback(
    (expiresAtUtc: Date) => {
      const tick = () => {
        clearTimeout(expiryTimer.current)
        // setTimeout plafonne à ~24,8 jours ; au-delà on re-planifie par tranche.
        const delay = Math.min(expiresAtUtc.getTime() - Date.now(), 2 ** 31 - 1)
        expiryTimer.current = setTimeout(
          () => (tokenStore.isValid() ? tick() : endSession()),
          Math.max(delay, 0),
        )
      }
      tick()
    },
    [endSession],
  )

  const startSession = useCallback(
    (response: LoginResponse) => {
      tokenStore.set(response.token, response.expiresAtUtc)
      scheduleExpiry(new Date(response.expiresAtUtc))
      setUser(response.user)
      setStatus('authenticated')
      return response.user
    },
    [scheduleExpiry],
  )

  // Un 401 sur un appel authentifié met fin à la session proprement.
  useEffect(() => {
    setUnauthorizedHandler(endSession)
    return () => setUnauthorizedHandler(null)
  }, [endSession])

  // Rechargement du profil au démarrage si un jeton valide existe.
  useEffect(() => {
    if (!tokenStore.isValid()) {
      if (tokenStore.get()) tokenStore.clear() // jeton expiré : on nettoie
      return
    }
    let cancelled = false
    const expiry = tokenStore.getExpiry()
    if (expiry) scheduleExpiry(expiry)
    api
      .get<User>('/api/auth/me')
      .then(({ data }) => {
        if (cancelled) return
        setUser(data)
        setStatus('authenticated')
      })
      .catch((error: { status?: number | null }) => {
        if (cancelled) return
        // 401 déjà traité par l'intercepteur ; pour une panne réseau on reste déconnecté
        // sans détruire le jeton, l'utilisateur pourra réessayer en rechargeant.
        if (error.status !== 401) {
          setUser(null)
          setStatus('anonymous')
        }
      })
    return () => {
      cancelled = true
      clearTimeout(expiryTimer.current)
    }
  }, [scheduleExpiry])

  const login = useCallback(
    async (credentials: LoginRequest) => {
      const { data } = await api.post<LoginResponse>('/api/auth/login', credentials)
      return startSession(data)
    },
    [startSession],
  )

  const register = useCallback(
    async (data: RegisterRequest) => {
      await api.post('/api/auth/register', data)
      return login({ identifiant: data.email, password: data.password })
    },
    [login],
  )

  const logout = useCallback(() => clearSession(), [clearSession])

  const refreshProfile = useCallback(async () => {
    const { data } = await api.get<User>('/api/auth/me')
    setUser(data)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      hasRole: (role) => user?.roles.includes(role) ?? false,
      login,
      register,
      logout,
      refreshProfile,
    }),
    [user, status, login, register, logout, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth doit être utilisé dans <AuthProvider>.')
  return context
}
