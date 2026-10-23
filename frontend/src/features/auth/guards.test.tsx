import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RequireAuth, RequireRole } from './guards'

const auth = vi.hoisted(() => ({
  value: {
    status: 'anonymous' as 'anonymous' | 'loading' | 'authenticated',
    roles: [] as string[],
  },
}))

vi.mock('./AuthContext', () => ({
  useAuth: () => ({
    status: auth.value.status,
    hasRole: (role: string) => auth.value.roles.includes(role),
  }),
}))

function Where() {
  const { pathname, state } = useLocation()
  return (
    <p data-testid="where">
      {pathname} {JSON.stringify(state)}
    </p>
  )
}

function renderAt(path: string, forbidden?: boolean) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/admin/*"
          element={
            <RequireRole
              role="Admin"
              fallback={<p>chargement</p>}
              forbidden={forbidden ? <p>403 interdit</p> : undefined}
            >
              <p>zone admin</p>
            </RequireRole>
          }
        />
        <Route
          path="/panier"
          element={
            <RequireAuth>
              <p>panier</p>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('garde de rôle', () => {
  beforeEach(() => {
    auth.value = { status: 'anonymous', roles: [] }
  })

  it("invité : redirigé vers /connexion avec le chemin d'origine", () => {
    renderAt('/admin/commandes', true)
    expect(screen.getByTestId('where')).toHaveTextContent('/connexion {"from":"/admin/commandes"}')
  })

  it('client connecté : page 403, jamais le contenu admin', () => {
    auth.value = { status: 'authenticated', roles: ['Client'] }
    renderAt('/admin/commandes', true)
    expect(screen.getByText('403 interdit')).toBeInTheDocument()
    expect(screen.queryByText('zone admin')).not.toBeInTheDocument()
  })

  it("client connecté sans page 403 fournie : renvoyé à l'accueil (comportement historique)", () => {
    auth.value = { status: 'authenticated', roles: ['Client'] }
    renderAt('/admin/commandes')
    expect(screen.getByTestId('where')).toHaveTextContent('/')
    expect(screen.queryByText('zone admin')).not.toBeInTheDocument()
  })

  it('administrateur : accès accordé', () => {
    auth.value = { status: 'authenticated', roles: ['Admin'] }
    renderAt('/admin/commandes', true)
    expect(screen.getByText('zone admin')).toBeInTheDocument()
  })

  it('pendant le rechargement du profil : ni contenu ni redirection', () => {
    auth.value = { status: 'loading', roles: [] }
    renderAt('/admin/commandes', true)
    expect(screen.getByText('chargement')).toBeInTheDocument()
    expect(screen.queryByText('zone admin')).not.toBeInTheDocument()
  })

  it('RequireAuth redirige aussi un invité', () => {
    renderAt('/panier')
    expect(screen.getByTestId('where')).toHaveTextContent('/connexion {"from":"/panier"}')
  })
})
