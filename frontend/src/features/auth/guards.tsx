import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

/** Écran affiché pendant le rechargement du profil (squelette fourni par l'app). */
function useGuard() {
  const { status } = useAuth()
  return status
}

export function RequireAuth({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const status = useGuard()
  const location = useLocation()
  if (status === 'loading') return <>{fallback ?? null}</>
  if (status === 'anonymous') {
    return (
      <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />
    )
  }
  return <>{children}</>
}

export function RequireRole({
  role,
  children,
  fallback,
}: {
  role: string
  children: ReactNode
  fallback?: ReactNode
}) {
  const { status, hasRole } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <>{fallback ?? null}</>
  if (status === 'anonymous') {
    return (
      <Navigate to="/connexion" replace state={{ from: location.pathname + location.search }} />
    )
  }
  if (!hasRole(role)) return <Navigate to="/" replace />
  return <>{children}</>
}
