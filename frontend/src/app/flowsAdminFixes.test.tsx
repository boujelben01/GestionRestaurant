import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accountLinksFor, ADMIN_LINK, ACCOUNT_LINKS } from '@/components/layout/nav'
import i18n from '@/lib/i18n'
import { tokenStore } from '@/lib/tokenStore'
import type { AdminOrder, AdminOrderSummary, User } from '@/lib/types'
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
})
afterEach(() => mock?.restore())

describe('liens du menu utilisateur selon le rôle', () => {
  it('un admin ne garde que « Administration » ; un client garde Mes commandes, Mes favoris et Profil', () => {
    expect(accountLinksFor(['Admin'])).toEqual([ADMIN_LINK])
    expect(accountLinksFor(['Client'])).toEqual([...ACCOUNT_LINKS])
    expect(accountLinksFor([])).toEqual([...ACCOUNT_LINKS])
    expect(accountLinksFor(['Client', 'Admin'])).toEqual([ADMIN_LINK])
    expect(ACCOUNT_LINKS.map((l) => l.to)).toEqual(['/commandes', '/favoris', '/profil'])
  })

  const openMenu = async (user: User) => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: user }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/menu': () => ({ data: [] }),
      'GET /api/panier': () => ({
        data: { lignes: [], nombreArticles: 0, sousTotal: 0, dateMiseAJour: null },
      }),
    })
    renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: /Menu du compte de/ }))
    return within(await screen.findByRole('navigation', { name: 'Mon compte' }))
  }

  it('admin : « Administration » et « Se déconnecter » seulement (desktop)', async () => {
    const nav = await openMenu(admin)

    expect(nav.getByRole('link', { name: 'Administration' })).toHaveAttribute('href', '/admin')
    expect(nav.queryByRole('link', { name: 'Mes commandes' })).not.toBeInTheDocument()
    expect(nav.queryByRole('link', { name: 'Profil' })).not.toBeInTheDocument()
    expect(nav.queryByRole('link', { name: 'Mes favoris' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Se déconnecter' })).toBeInTheDocument()
  })

  it("client : rien ne change (Mes commandes, Mes favoris, Profil, pas d'Administration)", async () => {
    const nav = await openMenu(client)

    expect(nav.getByRole('link', { name: 'Mes commandes' })).toHaveAttribute('href', '/commandes')
    expect(nav.getByRole('link', { name: 'Mes favoris' })).toHaveAttribute('href', '/favoris')
    expect(nav.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/profil')
    expect(nav.queryByRole('link', { name: 'Administration' })).not.toBeInTheDocument()
  })

  it('les routes /commandes et /profil restent protégées pour un invité', async () => {
    mock = mockApi({ 'GET /api/restaurant': () => ({ status: 500, data: {} }) })
    const router = renderApp('/profil')
    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
  })
})

describe('ErrorState : code HTTP et référence', () => {
  it("affiche HTTP 500 et la référence (correlationId) renvoyés par l'API", async () => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: admin }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/admin/categories': () => ({
        status: 500,
        data: { title: 'Une erreur interne est survenue.', correlationId: 'req-7f3a9c21' },
      }),
      'GET /api/admin/articles': () => ({ data: { items: [], page: 1, pageSize: 20, total: 0 } }),
    })
    renderApp('/admin/menu')

    await userEvent.click(await screen.findByRole('tab', { name: 'Catégories' }))
    expect(await screen.findByText(/HTTP 500/)).toBeInTheDocument()
    expect(screen.getByText(/Réf\. req-7f3a9c21/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it("ne montre ni code ni référence quand l'erreur n'en porte pas", async () => {
    mock = mockApi({
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/menu': () => ({ data: [] }),
    })
    renderApp('/contact')

    // Le pied de page et la page Contact échouent sur /api/restaurant : un 500 sans correlationId.
    const alerts = await screen.findAllByRole('alert')
    expect(alerts.length).toBeGreaterThan(0)
    expect(screen.queryByText(/Réf\./)).not.toBeInTheDocument()
    expect(screen.getAllByText(/HTTP 500/).length).toBeGreaterThan(0)
  })
})

describe('« Nouvel article » avec les catégories indisponibles', () => {
  const articlesOk = {
    'GET /api/admin/articles': (() => ({
      data: { items: [], page: 1, pageSize: 20, total: 0 },
    })) as MockHandler,
  }

  it("le dialogue s'ouvre même si GET /api/admin/categories échoue ; seul Enregistrer est inactif", async () => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: admin }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/admin/categories': () => ({
        status: 500,
        data: { title: 'Erreur', correlationId: 'req-1' },
      }),
      ...articlesOk,
    })
    renderApp('/admin/menu')

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvel article' }))
    const dialog = await screen.findByRole('dialog')

    // Les autres champs restent saisissables.
    const name = within(dialog).getByLabelText(/Nom.*français|^Nom \(fr/i)
    await userEvent.type(name, 'Brik au thon')
    expect(name).toHaveValue('Brik au thon')
    // L'erreur de catégories est expliquée dans le champ, avec Réessayer.
    await waitFor(() => expect(within(dialog).getByText(/HTTP 500/)).toBeInTheDocument())
    expect(within(dialog).getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    // Enregistrer est bloqué et un clic n'envoie rien.
    const save = within(dialog).getByRole('button', { name: 'Enregistrer' })
    expect(save).toHaveAttribute('aria-disabled', 'true')
    await userEvent.click(save)
    expect(mock.calls.some((c) => c.method === 'post')).toBe(false)
  })

  it("le dialogue s'ouvre aussi pendant le chargement des catégories", async () => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: admin }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/admin/categories': () => new Promise(() => {}) as never, // ne répond jamais
      ...articlesOk,
    })
    renderApp('/admin/menu')

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvel article' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('button', { name: 'Enregistrer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
  })

  it('« Réessayer » recharge les catégories et le champ redevient un choix', async () => {
    signIn()
    let healthy = false
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: admin }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/admin/categories': () =>
        healthy
          ? {
              data: [
                {
                  id: 1,
                  nomFr: 'Entrées',
                  ordre: 1,
                  estActive: true,
                  nombreArticlesActifs: 0,
                },
              ],
            }
          : { status: 500, data: { title: 'Erreur' } },
      ...articlesOk,
    })
    renderApp('/admin/menu')

    await userEvent.click(await screen.findByRole('button', { name: 'Nouvel article' }))
    const dialog = await screen.findByRole('dialog')
    const retry = await within(dialog).findByRole('button', { name: 'Réessayer' })
    healthy = true // le serveur est rétabli
    await userEvent.click(retry)

    expect(await within(dialog).findByRole('option', { name: 'Entrées' })).toBeInTheDocument()
  })
})

describe("paiement depuis le détail d'une commande", () => {
  const summary = (
    id: number,
    statut: AdminOrderSummary['statut'],
    estPayee: boolean,
  ): AdminOrderSummary => ({
    id,
    numero: `CMD-${String(id).padStart(6, '0')}`,
    statut,
    typeCommande: 'ARemporter',
    nomClient: 'Sami',
    telephone: '+21620123456',
    tableNumero: null,
    total: 9,
    estPayee,
    nombreArticles: 2,
    dateCommande: '2024-06-01T10:00:00Z',
    dateMiseAJour: '2024-06-01T10:00:00Z',
  })
  const detail = (s: AdminOrderSummary, version = 1): AdminOrder => ({
    id: s.id,
    numero: s.numero,
    statut: s.statut,
    statutsSuivants: [],
    typeCommande: s.typeCommande,
    modePaiement: 'Especes',
    estPayee: s.estPayee,
    sousTotal: 9,
    fraisLivraison: 0,
    total: 9,
    note: null,
    adresseLivraison: null,
    tableNumero: null,
    client: { userId: 'u1', nom: s.nomClient, telephone: s.telephone },
    dateCommande: s.dateCommande,
    dateMiseAJour: s.dateMiseAJour,
    lignes: [],
    historique: [],
    version,
  })

  const openHistory = async (
    orders: AdminOrderSummary[],
    handlers: Record<string, MockHandler>,
  ) => {
    signIn()
    mock = mockApi({
      'GET /api/auth/me': () => ({ data: admin }),
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/admin/commandes/actives': () => ({ data: [] }),
      'GET /api/admin/commandes/compteurs': () => ({
        data: { date: '2024-06-01', parStatut: [], totalAujourdhui: 0, enAttente: 0 },
      }),
      'GET /api/admin/commandes': () => ({
        data: { items: orders, page: 1, pageSize: 20, total: orders.length },
      }),
      ...handlers,
    })
    renderApp('/admin/commandes')
    await userEvent.click(await screen.findByRole('tab', { name: 'Historique' }))
  }

  it('commande terminée : « Marquer payée » est autorisé et met à jour détail et liste', async () => {
    const s = summary(5, 'Terminee', false)
    let paid = false
    await openHistory([{ ...s, estPayee: paid }], {
      'GET /api/admin/commandes/5': () => ({
        data: { ...detail(s, paid ? 2 : 1), estPayee: paid },
      }),
      'PATCH /api/admin/commandes/5/paiement': (config) => {
        paid = JSON.parse(String(config.data)).estPayee
        return { data: { ...detail(s, 2), estPayee: paid } }
      },
    })

    await userEvent.click((await screen.findAllByRole('button', { name: /CMD-000005/ }))[0]!)
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Marquer payée' }))

    await waitFor(() => {
      const patch = mock!.calls.find((c) => c.method === 'patch')
      expect(JSON.parse(String(patch?.data))).toEqual({ estPayee: true })
    })
    expect(
      await within(dialog).findByRole('button', { name: 'Marquer non payée' }),
    ).toBeInTheDocument()
    expect(await within(dialog).findByText('Payée')).toBeInTheDocument()
  })

  it('commande annulée : bouton inactif avec explication, aucun appel', async () => {
    const s = summary(6, 'Annulee', false)
    await openHistory([s], {
      'GET /api/admin/commandes/6': () => ({ data: detail(s) }),
    })

    await userEvent.click((await screen.findAllByRole('button', { name: /CMD-000006/ }))[0]!)
    const dialog = await screen.findByRole('dialog')
    const button = await within(dialog).findByRole('button', { name: 'Marquer payée' })

    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(
      within(dialog).getByText('Une commande annulée ne peut pas être encaissée.'),
    ).toBeInTheDocument()
    await userEvent.click(button)
    expect(mock!.calls.some((c) => c.method === 'patch')).toBe(false)
  })

  it('409 du serveur : message clair et état précédent conservé', async () => {
    const s = summary(7, 'Terminee', false)
    await openHistory([s], {
      'GET /api/admin/commandes/7': () => ({ data: detail(s) }),
      'PATCH /api/admin/commandes/7/paiement': () => ({ status: 409, data: { title: 'Conflit' } }),
    })

    await userEvent.click((await screen.findAllByRole('button', { name: /CMD-000007/ }))[0]!)
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('button', { name: 'Marquer payée' }))

    expect(
      await screen.findByText(/a changé ou cette transition n’est plus possible/),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Marquer payée' })).toBeInTheDocument(),
    )
    expect(within(dialog).getByText('À encaisser')).toBeInTheDocument()
  })
})
