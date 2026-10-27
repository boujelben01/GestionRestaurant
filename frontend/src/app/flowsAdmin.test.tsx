import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { resetAudioForTests, soundPreference } from '@/features/admin/orders/alertSound'
import i18n from '@/lib/i18n'
import { tokenStore } from '@/lib/tokenStore'
import type { ActiveOrder, AdminCategory, AdminOrder, AdminUser, User } from '@/lib/types'
import { mockApi, type MockHandler } from '@/test/mockApi'
import { Providers } from './providers'
import { routes } from './router'

const admin: User = {
  id: 'u-admin',
  userName: 'admin',
  nom: 'Admin',
  email: 'admin@example.com',
  telephone: null,
  roles: ['Admin'],
  langueFavorite: 'fr',
}
const client: User = {
  ...admin,
  id: 'u-client',
  userName: 'client',
  nom: 'Yazid',
  roles: ['Client'],
}

const active = (id: number, statut: ActiveOrder['statut'], version = 1): ActiveOrder => ({
  id,
  numero: `CMD-${String(id).padStart(6, '0')}`,
  statut,
  typeCommande: 'ARemporter',
  nomClient: `Client ${id}`,
  tableNumero: null,
  note: null,
  dateCommande: new Date().toISOString(),
  dateMiseAJour: new Date().toISOString(),
  lignes: [{ nomFr: 'Brik', quantite: 2 }],
  version,
})

const detail = (o: ActiveOrder): AdminOrder => ({
  id: o.id,
  numero: o.numero,
  statut: o.statut,
  statutsSuivants: [],
  typeCommande: o.typeCommande,
  modePaiement: 'Especes',
  estPayee: false,
  sousTotal: 9,
  fraisLivraison: 0,
  total: 9,
  note: o.note,
  adresseLivraison: null,
  tableNumero: null,
  client: { userId: 'u1', nom: o.nomClient, telephone: '+21620123456' },
  dateCommande: o.dateCommande,
  dateMiseAJour: o.dateMiseAJour,
  lignes: [{ articleId: 1, nomFr: 'Brik', prixUnitaire: 4.5, quantite: 2, totalLigne: 9 }],
  historique: [],
  version: o.version,
})

const counters = { date: '2024-06-01', parStatut: [], totalAujourdhui: 0, enAttente: 1 }

function boardHandlers(state: { orders: ActiveOrder[] }): Record<string, MockHandler> {
  const handlers: Record<string, MockHandler> = {
    'GET /api/auth/me': () => ({ data: admin }),
    'GET /api/restaurant': () => ({ status: 500, data: {} }),
    'GET /api/admin/commandes/actives': () => ({ data: state.orders }),
    'GET /api/admin/commandes/compteurs': () => ({ data: counters }),
  }
  for (let id = 1; id <= 12; id++) {
    handlers[`GET /api/admin/commandes/${id}`] = () => {
      const o = state.orders.find((x) => x.id === id)
      return o ? { data: detail(o) } : { status: 404, data: { title: 'introuvable' } }
    }
  }
  return handlers
}

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

const signIn = () => tokenStore.set('jwt', new Date(Date.now() + 3_600_000).toISOString())

let mock: ReturnType<typeof mockApi> | undefined
beforeEach(async () => {
  await i18n.changeLanguage('fr')
  soundPreference.set(true)
  resetAudioForTests()
})
afterEach(() => {
  mock?.restore()
  vi.useRealTimers()
  resetAudioForTests()
})

describe('accès /admin', () => {
  it('invité : redirigé vers /connexion avec retour mémorisé', async () => {
    mock = mockApi({ 'GET /api/restaurant': () => ({ status: 500, data: {} }) })
    const router = renderApp('/admin/commandes')

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
    expect(router.state.location.state).toEqual({ from: '/admin/commandes' })
  })

  it('client connecté : page 403 claire, aucune donnée admin demandée', async () => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: client }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
    })
    const router = renderApp('/admin/commandes')

    expect(await screen.findByText('Accès refusé')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/admin/commandes')
    expect(mock.calls.some((c) => c.url?.startsWith('/api/admin'))).toBe(false)
  })

  it("administrateur : accès à l'écran des commandes", async () => {
    signIn()
    mock = mockApi(boardHandlers({ orders: [active(1, 'EnAttente')] }))
    renderApp('/admin/commandes')

    expect(await screen.findByText('CMD-000001')).toBeInTheDocument()
    expect(screen.queryByText('Accès refusé')).not.toBeInTheDocument()
  })
})

describe('écran des commandes', () => {
  it('propose uniquement les transitions valides de chaque statut', async () => {
    signIn()
    mock = mockApi(
      boardHandlers({
        orders: [active(1, 'EnAttente'), active(2, 'EnPreparation'), active(3, 'Prete')],
      }),
    )
    renderApp('/admin/commandes')
    await screen.findByText('CMD-000001')

    const card = (numero: string) => screen.getByText(numero).closest('li') as HTMLElement
    const buttons = (numero: string) =>
      within(card(numero))
        .getAllByRole('button')
        .map((b) => b.textContent?.trim())

    expect(buttons('CMD-000001')).toEqual(expect.arrayContaining(['Préparer', 'Annuler']))
    expect(buttons('CMD-000001')).not.toContain('Prête')
    expect(buttons('CMD-000001')).not.toContain('Terminée')
    expect(buttons('CMD-000002')).toEqual(expect.arrayContaining(['Prête', 'Annuler']))
    expect(buttons('CMD-000002')).not.toContain('Terminée')
    expect(buttons('CMD-000003')).toEqual(expect.arrayContaining(['Terminée', 'Annuler']))
    expect(buttons('CMD-000003')).not.toContain('Préparer')
  })

  it('avance une commande en envoyant la version, de façon optimiste', async () => {
    signIn()
    const state = { orders: [active(1, 'EnAttente', 7)] }
    const handlers = boardHandlers(state)
    handlers['PATCH /api/admin/commandes/1/statut'] = (config) => {
      const body = JSON.parse(String(config.data)) as { statut: ActiveOrder['statut'] }
      state.orders = [active(1, body.statut, 8)]
      return { data: { ...detail(state.orders[0]!), statut: body.statut, version: 8 } }
    }
    mock = mockApi(handlers)
    renderApp('/admin/commandes')

    const card = (await screen.findByText('CMD-000001')).closest('li') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Préparer' }))

    await waitFor(() => {
      const patch = mock!.calls.find((c) => c.method === 'patch')
      expect(JSON.parse(String(patch?.data))).toEqual({ statut: 'EnPreparation', version: 7 })
    })
    // La commande est maintenant proposée à l'étape suivante.
    const moved = (await screen.findByText('CMD-000001')).closest('li') as HTMLElement
    expect(await within(moved).findByRole('button', { name: 'Prête' })).toBeInTheDocument()
  })

  it('409 : message clair, aucune carte perdue, écran rechargé', async () => {
    signIn()
    const state = { orders: [active(1, 'EnAttente', 7)] }
    const handlers = boardHandlers(state)
    handlers['PATCH /api/admin/commandes/1/statut'] = () => {
      state.orders = [active(1, 'EnPreparation', 8)] // un autre admin l'a déjà prise
      return { status: 409, data: { title: 'La commande a été modifiée entre-temps.' } }
    }
    mock = mockApi(handlers)
    renderApp('/admin/commandes')

    const card = (await screen.findByText('CMD-000001')).closest('li') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Préparer' }))

    expect(
      await screen.findByText(/a changé ou cette transition n’est plus possible/),
    ).toBeInTheDocument()
    const reloaded = (await screen.findByText('CMD-000001')).closest('li') as HTMLElement
    expect(await within(reloaded).findByRole('button', { name: 'Prête' })).toBeInTheDocument() // état serveur
  })

  it("l'annulation passe par une confirmation", async () => {
    signIn()
    const state = { orders: [active(1, 'EnAttente')] }
    const handlers = boardHandlers(state)
    handlers['PATCH /api/admin/commandes/1/statut'] = () => {
      state.orders = []
      return { data: { ...detail(active(1, 'Annulee', 2)), statut: 'Annulee', version: 2 } }
    }
    mock = mockApi(handlers)
    renderApp('/admin/commandes')

    const card = (await screen.findByText('CMD-000001')).closest('li') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: 'Annuler' }))
    const dialog = await screen.findByRole('dialog')
    expect(mock.calls.some((c) => c.method === 'patch')).toBe(false) // rien n'est envoyé avant confirmation
    await userEvent.click(
      within(dialog).getByRole('button', { name: /Annuler la commande|Oui|Confirmer/ }),
    )

    await waitFor(() => expect(mock!.calls.some((c) => c.method === 'patch')).toBe(true))
    const patch = mock.calls.find((c) => c.method === 'patch')
    expect(JSON.parse(String(patch?.data)).statut).toBe('Annulee')
  })

  it('alerte une NOUVELLE commande entre deux relevés, jamais au premier chargement', async () => {
    signIn()
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const oscillators = vi.fn()
    class FakeAudioContext {
      state = 'suspended'
      currentTime = 0
      destination = {}
      resume() {
        this.state = 'running'
        return Promise.resolve()
      }
      createOscillator() {
        oscillators()
        return {
          type: '',
          frequency: { value: 0 },
          connect: (n: unknown) => n,
          start: vi.fn(),
          stop: vi.fn(),
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: (n: unknown) => n,
        }
      }
    }
    const savedCtx = window.AudioContext
    window.AudioContext = FakeAudioContext as unknown as typeof AudioContext
    try {
      const state = { orders: [active(1, 'EnAttente'), active(2, 'EnPreparation')] }
      mock = mockApi(boardHandlers(state))
      renderApp('/admin/commandes')
      await screen.findByText('CMD-000001')

      // Premier chargement : deux commandes déjà présentes, aucune annonce ni son.
      expect(screen.queryByText(/Nouvelle commande CMD/)).not.toBeInTheDocument()
      expect(oscillators).not.toHaveBeenCalled()

      // Le navigateur autorise le son après un clic ; une commande arrive ensuite.
      const { unlockAudio } = await import('@/features/admin/orders/alertSound')
      await unlockAudio()
      state.orders = [...state.orders, active(3, 'EnAttente')]
      await vi.advanceTimersByTimeAsync(10_500)

      expect(await screen.findByText(/Nouvelle commande CMD-000003/)).toBeInTheDocument()
      await waitFor(() => expect(oscillators).toHaveBeenCalledTimes(2)) // carillon à deux notes, une seule fois

      // Relevé suivant sans nouveauté : pas de nouvelle alerte.
      await vi.advanceTimersByTimeAsync(10_500)
      expect(oscillators).toHaveBeenCalledTimes(2)
    } finally {
      window.AudioContext = savedCtx
    }
  })

  it("son coupé : la nouvelle commande est annoncée mais aucun son n'est joué", async () => {
    signIn()
    soundPreference.set(false)
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const oscillators = vi.fn()
    const savedCtx = window.AudioContext
    window.AudioContext = class {
      state = 'running'
      currentTime = 0
      destination = {}
      resume() {
        return Promise.resolve()
      }
      createOscillator() {
        oscillators()
        return {
          type: '',
          frequency: { value: 0 },
          connect: (n: unknown) => n,
          start: vi.fn(),
          stop: vi.fn(),
        }
      }
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
          connect: (n: unknown) => n,
        }
      }
    } as unknown as typeof AudioContext
    try {
      const state = { orders: [active(1, 'EnAttente')] }
      mock = mockApi(boardHandlers(state))
      renderApp('/admin/commandes')
      await screen.findByText('CMD-000001')
      state.orders = [...state.orders, active(2, 'EnAttente')]
      await vi.advanceTimersByTimeAsync(10_500)

      expect(await screen.findByText(/Nouvelle commande CMD-000002/)).toBeInTheDocument()
      expect(oscillators).not.toHaveBeenCalled()
    } finally {
      window.AudioContext = savedCtx
    }
  })
})

describe('utilisateurs', () => {
  // La liste existe en tableau (desktop) et en cartes (mobile) : jsdom n'applique pas le CSS, on cible le tableau.
  const findTable = () => screen.findByRole('table')

  const users: AdminUser[] = [
    {
      id: 'u-admin',
      userName: 'admin',
      email: 'admin@example.com',
      nom: 'Admin',
      estActif: true,
      dateCreation: '2024-01-01T10:00:00Z',
    },
    {
      id: 'u-sami',
      userName: 'sami',
      email: 'sami@example.com',
      nom: 'Sami Ben Ali',
      estActif: true,
      dateCreation: '2024-02-01T10:00:00Z',
    },
  ]

  it("impossible de se désactiver soi-même : bouton inactif avec explication, pas d'appel", async () => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: admin }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/admin/users': () => ({ data: { items: users, page: 1, pageSize: 20, total: 2 } }),
    })
    renderApp('/admin/utilisateurs')

    const selfRow = (await within(await findTable()).findByText('admin@example.com')).closest(
      'tr',
    ) as HTMLElement
    const selfButton = within(selfRow).getByRole('button', { name: /Désactiver/ })
    expect(selfButton).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(selfRow).getByText('Vous ne pouvez pas désactiver votre propre compte.'),
    ).toBeInTheDocument()

    await userEvent.click(selfButton)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(mock.calls.some((c) => c.method === 'patch')).toBe(false)

    const otherRow = within(screen.getByRole('table'))
      .getByText('sami@example.com')
      .closest('tr') as HTMLElement
    expect(within(otherRow).getByRole('button', { name: /Désactiver/ })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('désactive un autre compte après confirmation', async () => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: admin }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/admin/users': () => ({ data: { items: users, page: 1, pageSize: 20, total: 2 } }),
      'PATCH /api/admin/users/u-sami/actif': () => ({ data: { ...users[1], estActif: false } }),
    })
    renderApp('/admin/utilisateurs')

    const row = (await within(await findTable()).findByText('sami@example.com')).closest(
      'tr',
    ) as HTMLElement
    await userEvent.click(within(row).getByRole('button', { name: /Désactiver/ }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Désactiver' }))

    await waitFor(() => {
      const patch = mock!.calls.find((c) => c.method === 'patch')
      expect(JSON.parse(String(patch?.data))).toEqual({ estActif: false })
    })
  })
})

describe("formulaire d'article", () => {
  const categories: AdminCategory[] = [
    {
      id: 1,
      nomFr: 'Entrées',
      ordre: 1,
      estActive: true,
      nombreArticlesActifs: 2,
    },
  ]
  const menuHandlers = (): Record<string, MockHandler> => ({
    'GET /api/auth/me': () => ({ data: admin }),
    'GET /api/restaurant': () => ({ status: 500, data: {} }),
    'GET /api/admin/categories': () => ({ data: categories }),
    'GET /api/admin/articles': () => ({ data: { items: [], page: 1, pageSize: 20, total: 0 } }),
  })

  it('refuse une image invalide, un prix à 3 décimales et les champs manquants sans rien envoyer', async () => {
    signIn()
    mock = mockApi(menuHandlers())
    renderApp('/admin/menu')

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvel article' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Prix/), '4,555')
    await userEvent.type(within(dialog).getByLabelText(/^Image/), 'http://exemple.com/a.jpg')
    await userEvent.click(within(dialog).getByRole('button', { name: /Enregistrer|Créer/ }))

    await waitFor(() =>
      expect(within(dialog).getByLabelText(/^Prix/)).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(within(dialog).getByLabelText(/^Image/)).toHaveAttribute('aria-invalid', 'true')
    expect(mock.calls.some((c) => c.method === 'post')).toBe(false)
  })

  it('envoie un article valide avec prix numérique et image locale', async () => {
    signIn()
    let body: unknown
    mock = mockApi({
      ...menuHandlers(),
      'POST /api/admin/articles': (config) => {
        body = JSON.parse(String(config.data))
        return { status: 201, data: { id: 9, ...(body as object) } }
      },
    })
    renderApp('/admin/menu')

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvel article' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText(/^Catégorie/), '1')
    await userEvent.type(within(dialog).getByLabelText(/Nom.*français|^Nom \(fr/i), 'Brik au thon')
    await userEvent.type(within(dialog).getByLabelText(/^Prix/), '4,5')
    await userEvent.type(within(dialog).getByLabelText(/^Image/), '/images/default.svg')
    await userEvent.click(within(dialog).getByRole('button', { name: /Enregistrer|Créer/ }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toMatchObject({
      categorieId: 1,
      nomFr: 'Brik au thon',
      prix: 4.5,
      imageUrl: '/images/default.svg',
      descriptionFr: null,
      estDisponible: true,
    })
  })
})
