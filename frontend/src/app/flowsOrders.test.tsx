import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { tokenStore } from '@/lib/tokenStore'
import type { Commande, MenuCategorie, Panier, User } from '@/lib/types'
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

const order = (over: Partial<Commande> = {}): Commande => ({
  id: 5,
  numero: 'CMD-000005',
  statut: 'EnAttente',
  typeCommande: 'ARemporter',
  modePaiement: 'Especes',
  estPayee: false,
  sousTotal: 13,
  fraisLivraison: 0,
  total: 13,
  note: null,
  adresseLivraison: null,
  tableNumero: null,
  dateCommande: '2024-06-01T10:00:00Z',
  lignes: [
    {
      articleId: 101,
      nomFr: 'Brik à l’œuf',
      prixUnitaire: 4.5,
      quantite: 2,
      totalLigne: 9,
    },
    {
      articleId: 102,
      nomFr: 'Salade épuisée',
      prixUnitaire: 4,
      quantite: 1,
      totalLigne: 4,
    },
  ],
  historique: [{ statut: 'EnAttente', date: '2024-06-01T10:00:00Z' }],
  ...over,
})

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
        description: null,
        prix: 4.5,
        imageUrl: null,
        estPopulaire: false,
        disponible: true,
      },
      {
        id: 102,
        categorieId: 1,
        nom: 'Salade épuisée',
        description: null,
        prix: 4,
        imageUrl: null,
        estPopulaire: false,
        disponible: false,
      },
    ],
  },
]

const emptyCart: Panier = { lignes: [], nombreArticles: 0, sousTotal: 0, dateMiseAJour: null }

const base = (): Record<string, MockHandler> => ({
  'GET /api/auth/me': () => ({ data: user }),
  'GET /api/restaurant': () => ({ status: 500, data: {} }),
  'GET /api/panier': () => ({ data: emptyCart }),
  'GET /api/menu': () => ({ data: menu }),
})

function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(
    <Providers>
      <RouterProvider router={router} />
    </Providers>,
  )
  return router
}

let mock: ReturnType<typeof mockApi> | undefined
beforeEach(async () => {
  tokenStore.set('jwt', new Date(Date.now() + 3_600_000).toISOString())
  await i18n.changeLanguage('fr')
})
afterEach(() => {
  mock?.restore()
  vi.useRealTimers()
})

describe('/commandes : liste paginée', () => {
  it('charge la page suivante avec « Charger plus » puis masque le bouton', async () => {
    const summary = (id: number) => ({
      id,
      numero: `CMD-${String(id).padStart(6, '0')}`,
      statut: 'Terminee',
      typeCommande: 'ARemporter',
      total: 5,
      nombreArticles: 1,
      dateCommande: '2024-06-01T10:00:00Z',
    })
    mock = mockApi({
      ...base(),
      'GET /api/commandes': (config) => {
        const page = Number((config.params as { page: number }).page)
        return { data: { items: [summary(page === 1 ? 2 : 1)], page, pageSize: 1, total: 2 } }
      },
    })
    renderApp('/commandes')

    expect(await screen.findByText('CMD-000002')).toBeInTheDocument()
    expect(screen.queryByText('CMD-000001')).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Charger plus' }))
    expect(await screen.findByText('CMD-000001')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Charger plus' })).not.toBeInTheDocument(),
    )
  })

  it('état vide avec lien vers le menu', async () => {
    mock = mockApi({
      ...base(),
      'GET /api/commandes': () => ({ data: { items: [], page: 1, pageSize: 10, total: 0 } }),
    })
    renderApp('/commandes')

    expect(await screen.findByText('Aucune commande pour le moment')).toBeInTheDocument()
  })
})

describe('/commandes/:id : détail et actions', () => {
  it("affiche les lignes, les totaux serveur et l'annulation seulement en attente", async () => {
    mock = mockApi({ ...base(), 'GET /api/commandes/5': () => ({ data: order() }) })
    renderApp('/commandes/5')

    expect(await screen.findByText('CMD-000005')).toBeInTheDocument()
    expect(screen.getAllByText(/Brik à l’œuf/).length).toBeGreaterThan(0)
    expect(screen.getByRole('button', { name: 'Annuler la commande' })).toBeInTheDocument()
  })

  it('pas de bouton Annuler une fois la commande en préparation', async () => {
    mock = mockApi({
      ...base(),
      'GET /api/commandes/5': () => ({
        data: order({
          statut: 'EnPreparation',
          historique: [
            { statut: 'EnAttente', date: '2024-06-01T10:00:00Z' },
            { statut: 'EnPreparation', date: '2024-06-01T10:05:00Z' },
          ],
        }),
      }),
    })
    renderApp('/commandes/5')

    await screen.findByText('CMD-000005')
    expect(screen.queryByRole('button', { name: 'Annuler la commande' })).not.toBeInTheDocument()
  })

  it('annulation : confirmation dans un Dialog puis statut Annulée', async () => {
    let current = order()
    mock = mockApi({
      ...base(),
      'GET /api/commandes/5': () => ({ data: current }),
      'POST /api/commandes/5/annuler': () => {
        current = order({
          statut: 'Annulee',
          historique: [...current.historique, { statut: 'Annulee', date: '2024-06-01T10:02:00Z' }],
        })
        return { data: current }
      },
    })
    renderApp('/commandes/5')

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la commande' }))
    const dialog = await screen.findByRole('dialog')
    expect(mock.calls.some((c) => c.method === 'post')).toBe(false) // pas d'annulation avant confirmation
    await userEvent.click(within(dialog).getByRole('button', { name: 'Oui, annuler' }))

    expect(await screen.findByText('Commande annulée.')).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Annuler la commande' })).not.toBeInTheDocument(),
    )
  })

  it('annulation refusée (409) : message dédié et rechargement du vrai statut', async () => {
    let current = order()
    mock = mockApi({
      ...base(),
      'GET /api/commandes/5': () => ({ data: current }),
      'POST /api/commandes/5/annuler': () => {
        current = order({ statut: 'EnPreparation' }) // l'admin a pris la commande entre-temps
        return { status: 409, data: { title: 'Seule une commande en attente peut être annulée.' } }
      },
    })
    renderApp('/commandes/5')

    await userEvent.click(await screen.findByRole('button', { name: 'Annuler la commande' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Oui, annuler' }),
    )

    expect(await screen.findByText(/déjà été prise en charge/)).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Annuler la commande' })).not.toBeInTheDocument(),
    )
  })

  it('« Commander à nouveau » : ajoute les articles disponibles et résume ceux qui manquent', async () => {
    mock = mockApi({
      ...base(),
      'GET /api/commandes/5': () => ({ data: order({ statut: 'Terminee' }) }),
      'POST /api/panier/items': () => ({ data: emptyCart }),
    })
    renderApp('/commandes/5')

    await userEvent.click(await screen.findByRole('button', { name: 'Commander à nouveau' }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getByText(/Salade épuisée/)).toBeInTheDocument()
    expect(within(dialog).getByText(/actuellement indisponible/)).toBeInTheDocument()
    expect(within(dialog).getByText(/Brik à l’œuf/)).toBeInTheDocument()
    const posts = mock.calls
      .filter((c) => c.method === 'post')
      .map((c) => JSON.parse(String(c.data)))
    expect(posts).toEqual([{ articleId: 101, quantite: 2 }])
  })

  it("404 : page « commande introuvable » (commande d'un autre client)", async () => {
    mock = mockApi({
      ...base(),
      'GET /api/commandes/99': () => ({ status: 404, data: { title: 'Commande introuvable.' } }),
    })
    renderApp('/commandes/99')

    expect(await screen.findByRole('link', { name: /Mes commandes|Retour/ })).toBeInTheDocument()
    expect(screen.queryByText('CMD-000099')).not.toBeInTheDocument()
  })

  it('suivi : un changement de statut détecté par le polling est annoncé (aria-live)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let current = order()
    mock = mockApi({ ...base(), 'GET /api/commandes/5': () => ({ data: current }) })
    renderApp('/commandes/5')
    await screen.findByText('CMD-000005')
    expect(screen.queryByText(/Statut de la commande :/)).not.toBeInTheDocument() // rien à l'affichage initial

    current = order({ statut: 'EnPreparation' })
    await vi.advanceTimersByTimeAsync(15_500)

    expect(await screen.findByText('Statut de la commande : En préparation')).toBeInTheDocument()
  })
})

describe('/profil', () => {
  it('enregistre nom et téléphone avec la langue favorite', async () => {
    let body: unknown
    mock = mockApi({
      ...base(),
      'PUT /api/auth/me': (config) => {
        body = JSON.parse(String(config.data))
        return { data: { ...user, nom: 'Nouveau nom' } }
      },
    })
    renderApp('/profil')

    const name = await screen.findByLabelText(/^Nom/)
    await userEvent.clear(name)
    await userEvent.type(name, 'Nouveau nom')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Profil mis à jour.')).toBeInTheDocument()
    expect(body).toEqual({ nom: 'Nouveau nom', telephone: '+21620123456', langueFavorite: 'fr' })
  })

  it("mot de passe : confirmation différente refusée côté client, rien n'est envoyé", async () => {
    mock = mockApi(base())
    renderApp('/profil')

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'AncienMdp123!')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauMdp123!')
    await userEvent.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), 'Autre12345!')
    await userEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }))

    expect(
      await screen.findByText('Les deux mots de passe ne sont pas identiques.'),
    ).toBeInTheDocument()
    expect(mock.calls.some((c) => c.url === '/api/auth/me/password')).toBe(false)
  })

  it("mot de passe : l'erreur serveur sur l'ancien mot de passe s'affiche sous le champ", async () => {
    mock = mockApi({
      ...base(),
      'POST /api/auth/me/password': () => ({
        status: 400,
        data: { errors: { CurrentPassword: ['Incorrect password.'] } },
      }),
    })
    renderApp('/profil')

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'Mauvais12345!')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'NouveauMdp123!')
    await userEvent.type(
      screen.getByLabelText('Confirmer le nouveau mot de passe'),
      'NouveauMdp123!',
    )
    await userEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }))

    expect(await screen.findByText('Le mot de passe actuel est incorrect.')).toBeInTheDocument()
  })

  it('un nouveau mot de passe de moins de 8 caractères est refusé côté client', async () => {
    mock = mockApi(base())
    renderApp('/profil')

    await userEvent.type(await screen.findByLabelText('Mot de passe actuel'), 'AncienMdp123!')
    await userEvent.type(screen.getByLabelText('Nouveau mot de passe'), 'court')
    await userEvent.type(screen.getByLabelText('Confirmer le nouveau mot de passe'), 'court')
    await userEvent.click(screen.getByRole('button', { name: 'Modifier le mot de passe' }))

    await waitFor(() =>
      expect(screen.getByLabelText('Nouveau mot de passe')).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(mock.calls.some((c) => c.url === '/api/auth/me/password')).toBe(false)
  })
})
