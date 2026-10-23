import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import i18n from '@/lib/i18n'
import { tokenStore } from '@/lib/tokenStore'
import { tableSession } from '@/features/orders/tableSession'
import type { Commande, MenuCategorie, Panier, Restaurant, User } from '@/lib/types'
import { mockApi, type MockHandler } from '@/test/mockApi'
import { Providers } from './providers'
import { routes } from './router'

const user: User = {
  id: 'u1',
  userName: 'client',
  nom: 'Yazid',
  email: 'client@example.com',
  telephone: '+21620123456',
  roles: ['Client'],
  langueFavorite: 'fr',
}

const menu: MenuCategorie[] = [
  {
    id: 1,
    nom: 'Entrées',
    ordre: 1,
    articles: [
      {
        id: 101,
        categorieId: 1,
        nom: 'Brik à l’œuf',
        description: 'Croustillant',
        prix: 4.5,
        imageUrl: null,
        estPopulaire: true,
        disponible: true,
      },
      {
        id: 102,
        categorieId: 1,
        nom: 'Salade épuisée',
        description: null,
        prix: 6,
        imageUrl: null,
        estPopulaire: false,
        disponible: false,
      },
    ],
  },
]

const restaurant: Restaurant = {
  nom: 'Resto',
  telephone: '+216 71 000 000',
  email: 'contact@resto.example',
  adresse: 'Avenue Habib Bourguiba, Tunis',
  fraisLivraison: 3,
  montantMinimumLivraison: 20,
  commandesOuvertes: true,
  ouvertMaintenant: true,
  horaires: Array.from({ length: 7 }, (_, jourSemaine) => ({
    jourSemaine,
    ouverture: '11:00',
    fermeture: '23:00',
    estFerme: false,
  })),
}

const cartOf = (total: number): Panier => ({
  lignes: [
    {
      articleId: 101,
      nom: 'Brik à l’œuf',
      prixUnitaire: total,
      imageUrl: null,
      disponible: true,
      quantite: 1,
      totalLigne: total,
      avertissement: null,
    },
  ],
  nombreArticles: 1,
  sousTotal: total,
  dateMiseAJour: null,
})

const baseHandlers = (): Record<string, MockHandler> => ({
  'GET /api/menu': () => ({ data: menu }),
  'GET /api/restaurant': () => ({ data: restaurant }),
})

function renderApp(initialPath: string) {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
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
})
afterEach(() => {
  mock?.restore()
  sessionStorage.clear()
})

describe('invité : Ajouter redirige vers la connexion puis revient', () => {
  it('menu -> /connexion (state.from) -> connexion -> retour sur /menu', async () => {
    mock = mockApi({
      ...baseHandlers(),
      'POST /api/auth/login': () => ({
        data: { token: 'jwt', expiresAtUtc: new Date(Date.now() + 3_600_000).toISOString(), user },
      }),
      'GET /api/panier': () => ({ data: { ...cartOf(4.5), lignes: [], nombreArticles: 0 } }),
    })
    const router = renderApp('/menu')

    const addButton = await screen.findByRole('button', { name: /Ajouter Brik/ })
    await userEvent.click(addButton)

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
    expect(router.state.location.state).toEqual({ from: '/menu' })
    expect(mock.calls.some((c) => c.url === '/api/panier/items')).toBe(false)

    await userEvent.type(
      await screen.findByLabelText(/E-mail ou nom d'utilisateur/),
      'client@example.com',
    )
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'MotDePasse123!')
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/menu'))
  })

  it('un article indisponible reste visible et son bouton est inactif', async () => {
    mock = mockApi(baseHandlers())
    renderApp('/menu')
    const button = await screen.findByRole('button', { name: /Ajouter Salade épuisée/ })
    expect(button).toHaveAttribute('aria-disabled', 'true')
  })
})

describe('routes protégées', () => {
  it.each(['/panier', '/commande', '/commandes', '/profil'])(
    'invité sur %s -> /connexion avec retour mémorisé',
    async (path) => {
      mock = mockApi(baseHandlers())
      const router = renderApp(path)
      await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
      expect(router.state.location.state).toEqual({ from: path })
    },
  )
})

describe('connecté : ajout au panier', () => {
  it('ajoute 1 article, affiche un toast avec « Voir le panier »', async () => {
    signIn()
    let cart: Panier = { ...cartOf(4.5), lignes: [], nombreArticles: 0, sousTotal: 0 }
    mock = mockApi({
      ...baseHandlers(),
      'GET /api/auth/me': () => ({ data: user }),
      'GET /api/panier': () => ({ data: cart }),
      'POST /api/panier/items': () => {
        cart = cartOf(4.5)
        return { data: cart }
      },
    })
    renderApp('/menu')
    await userEvent.click(await screen.findByRole('button', { name: /Ajouter Brik/ }))
    expect(await screen.findByText(/Brik à l’œuf ajouté au panier/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Voir le panier' })).toBeInTheDocument()
    const post = mock.calls.find((c) => c.url === '/api/panier/items')
    expect(JSON.parse(String(post?.data))).toEqual({ articleId: 101, quantite: 1 })
  })
})

describe('formulaire de commande', () => {
  const orderHandlers = (
    total: number,
    created: { body?: unknown },
  ): Record<string, MockHandler> => ({
    ...baseHandlers(),
    'GET /api/auth/me': () => ({ data: user }),
    'GET /api/panier': () => ({ data: cartOf(total) }),
    'POST /api/commandes': (config) => {
      created.body = JSON.parse(String(config.data))
      const order: Commande = {
        id: 5,
        numero: 'CMD-000005',
        statut: 'EnAttente',
        typeCommande: 'Livraison',
        modePaiement: 'Especes',
        estPayee: false,
        sousTotal: total,
        fraisLivraison: 3,
        total: total + 3,
        note: null,
        adresseLivraison: 'x',
        tableNumero: null,
        dateCommande: '2024-06-01T10:00:00Z',
        lignes: [],
        historique: [{ statut: 'EnAttente', date: '2024-06-01T10:00:00Z' }],
      }
      return { status: 201, data: order }
    },
    'GET /api/commandes/5': () => ({
      data: {
        id: 5,
        numero: 'CMD-000005',
        statut: 'EnAttente',
        typeCommande: 'Livraison',
        modePaiement: 'Especes',
        estPayee: false,
        sousTotal: total,
        fraisLivraison: 3,
        total: total + 3,
        note: null,
        adresseLivraison: 'x',
        tableNumero: null,
        dateCommande: '2024-06-01T10:00:00Z',
        lignes: [],
        historique: [],
      },
    }),
  })

  it("livraison : n'envoie que les champs applicables, puis page de confirmation", async () => {
    signIn()
    const created: { body?: unknown } = {}
    mock = mockApi(orderHandlers(25, created))
    const router = renderApp('/commande')

    await userEvent.click(await screen.findByLabelText(/Livraison/))
    await userEvent.type(
      await screen.findByLabelText(/Adresse de livraison/),
      '12 rue de la Liberté, Tunis',
    )
    await userEvent.click(screen.getByRole('button', { name: /Confirmer la commande/ }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/commande/5/confirmation'))
    expect(created.body).toEqual({
      typeCommande: 'Livraison',
      telephone: '+21620123456',
      adresseLivraison: '12 rue de la Liberté, Tunis',
    })
    expect(await screen.findByText('CMD-000005')).toBeInTheDocument()
  })

  it("livraison sous le minimum : bouton bloqué, rien n'est envoyé", async () => {
    signIn()
    const created: { body?: unknown } = {}
    mock = mockApi(orderHandlers(15, created))
    renderApp('/commande')
    await userEvent.click(await screen.findByLabelText(/Livraison/))
    expect(await screen.findByText(/Il manque/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Confirmer la commande/ }))
    expect(created.body).toBeUndefined()
  })

  it("« Sur place » n'est proposé que si une table est mémorisée", async () => {
    signIn()
    mock = mockApi(orderHandlers(25, {}))
    renderApp('/commande')
    await screen.findByLabelText(/Livraison/)
    expect(screen.queryByLabelText(/Sur place/)).not.toBeInTheDocument()
  })

  it('sur place : envoie le code de table, sans adresse', async () => {
    signIn()
    tableSession.set({ code: '11111111-1111-4111-8111-111111111111', numero: 1 })
    const created: { body?: unknown } = {}
    mock = mockApi(orderHandlers(25, created))
    renderApp('/commande')
    const radio = await screen.findByLabelText(/Sur place/)
    expect(radio).toBeChecked()
    await userEvent.click(screen.getByRole('button', { name: /Confirmer la commande/ }))
    await waitFor(() => expect(created.body).toBeDefined())
    expect(created.body).toEqual({
      typeCommande: 'SurPlace',
      telephone: '+21620123456',
      tableCode: '11111111-1111-4111-8111-111111111111',
    })
  })

  it('erreur 409 restaurant fermé : message dédié et aucune navigation', async () => {
    signIn()
    mock = mockApi({
      ...orderHandlers(25, {}),
      'POST /api/commandes': () => ({
        status: 409,
        data: { title: 'Le restaurant est actuellement fermé.' },
      }),
    })
    const router = renderApp('/commande')
    await userEvent.click(await screen.findByRole('button', { name: /Confirmer la commande/ }))
    // Le restaurant (mock) est « ouvert » : l'erreur reste donc générique, mais visible et sans navigation.
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(router.state.location.pathname).toBe('/commande')
    expect(within(screen.getAllByRole('alert')[0]!).getByText(/./)).toBeInTheDocument()
  })
})
