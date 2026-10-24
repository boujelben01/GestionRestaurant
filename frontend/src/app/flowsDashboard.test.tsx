import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addDays, tunisToday } from '@/features/admin/stats/period'
import i18n from '@/lib/i18n'
import { tokenStore } from '@/lib/tokenStore'
import type {
  Breakdown,
  PeakHour,
  SalesDay,
  StatsResume,
  StatsValues,
  TopArticle,
  User,
} from '@/lib/types'
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

const values = (over: Partial<StatsValues> = {}): StatsValues => ({
  chiffreAffaires: 1240.5,
  nombreCommandes: 50,
  panierMoyen: 24.81,
  nombreAnnulees: 3,
  montantAEncaisser: 80,
  nouveauxClients: 6,
  ...over,
})

const resume = (over: Partial<StatsResume> = {}): StatsResume => ({
  du: '2024-06-01',
  au: '2024-06-30',
  periode: values(),
  precedenteDu: '2024-05-02',
  precedenteAu: '2024-05-31',
  precedente: values({ chiffreAffaires: 1102.67, nombreCommandes: 40 }),
  variation: {
    chiffreAffaires: 12.5,
    nombreCommandes: 25,
    panierMoyen: -3,
    nombreAnnulees: 50,
    montantAEncaisser: null,
    nouveauxClients: 0,
  },
  ...over,
})

const days = (): SalesDay[] =>
  Array.from({ length: 30 }, (_, i) => ({
    date: addDays('2024-06-01', i),
    chiffreAffaires: i % 7 === 0 ? 0 : 40 + i,
    commandes: i % 7 === 0 ? 0 : 2,
  }))

const hours = (): PeakHour[] =>
  Array.from({ length: 24 }, (_, heure) => ({
    heure,
    commandes: heure === 20 ? 14 : 1,
    chiffreAffaires: heure * 3,
  }))

const top: TopArticle[] = [
  { articleId: 1, nom: 'Brik à l’œuf', quantite: 211, chiffreAffaires: 950 },
  { articleId: 2, nom: 'Makloub poulet', quantite: 185, chiffreAffaires: 1665 },
]

const breakdown: Breakdown = {
  parType: [
    { type: 'ARemporter', commandes: 22, chiffreAffaires: 500 },
    { type: 'SurPlace', commandes: 18, chiffreAffaires: 450 },
    { type: 'Livraison', commandes: 10, chiffreAffaires: 290.5 },
  ],
  parStatut: [
    { statut: 'EnAttente', commandes: 0, chiffreAffaires: 0 },
    { statut: 'EnPreparation', commandes: 0, chiffreAffaires: 0 },
    { statut: 'Prete', commandes: 0, chiffreAffaires: 0 },
    { statut: 'Terminee', commandes: 50, chiffreAffaires: 1240.5 },
    { statut: 'Annulee', commandes: 3, chiffreAffaires: 0 },
  ],
  parCategorie: [
    { categorieId: 1, nom: 'Sandwichs', quantite: 300, chiffreAffaires: 900 },
    { categorieId: null, nom: 'Autres', quantite: 12, chiffreAffaires: 40 },
  ],
}

const base = (over: Record<string, MockHandler> = {}): Record<string, MockHandler> => ({
  'GET /api/auth/me': () => ({ data: admin }),
  'GET /api/restaurant': () => ({ status: 500, data: {} }),
  'GET /api/admin/statistiques/resume': () => ({ data: resume() }),
  'GET /api/admin/statistiques/ventes-par-jour': () => ({ data: days() }),
  'GET /api/admin/statistiques/top-articles': () => ({ data: top }),
  'GET /api/admin/statistiques/heures-de-pointe': () => ({ data: hours() }),
  'GET /api/admin/statistiques/repartition': () => ({ data: breakdown }),
  ...over,
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

const lastParams = (mock: ReturnType<typeof mockApi>, route: string) =>
  mock.calls.filter((c) => c.url === `/api/admin/statistiques/${route}`).at(-1)?.params as Record<
    string,
    unknown
  >

/** Les libellés se retrouvent dans les tableaux de données des graphiques : on attend la carte d'indicateur. */
const ready = () => screen.findByRole('group', { name: /^Chiffre d’affaires :/ })

let mock: ReturnType<typeof mockApi> | undefined
beforeEach(async () => {
  await i18n.changeLanguage('fr')
  tokenStore.set('jwt', new Date(Date.now() + 3_600_000).toISOString())
})
afterEach(() => mock?.restore())

describe('accès et navigation', () => {
  it('/admin redirige vers le tableau de bord', async () => {
    mock = mockApi(base())
    const router = renderApp('/admin')

    await waitFor(() => expect(router.state.location.pathname).toBe('/admin/tableau-de-bord'))
    expect(await ready()).toBeInTheDocument()
  })

  it("le lien « Tableau de bord » est en tête de la navigation d'administration", async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord')

    const nav = (
      await screen.findAllByRole('navigation', { name: 'Navigation d’administration' })
    )[0]!
    const links = within(nav).getAllByRole('link')
    expect(links[0]).toHaveTextContent('Tableau de bord')
    expect(links[0]).toHaveAttribute('href', '/admin/tableau-de-bord')
    expect(links[1]).toHaveTextContent('Commandes')
  })

  it("un client ne voit pas le tableau de bord (403) et aucune statistique n'est demandée", async () => {
    mock = mockApi({
      ...base(),
      'GET /api/auth/me': () => ({ data: { ...admin, roles: ['Client'] } }),
    })
    renderApp('/admin/tableau-de-bord')

    expect(await screen.findByText('Accès refusé')).toBeInTheDocument()
    expect(mock.calls.some((c) => c.url?.startsWith('/api/admin/statistiques'))).toBe(false)
  })
})

describe('période', () => {
  it("par défaut : les 30 derniers jours, aujourd'hui à Tunis compris", async () => {
    mock = mockApi(base())
    const before = tunisToday()
    renderApp('/admin/tableau-de-bord')
    await ready()

    const params = lastParams(mock, 'resume')
    const after = tunisToday()
    expect([before, after]).toContain(params.au)
    expect(params.du).toBe(addDays(params.au as string, -29))
    // Les cinq lectures utilisent la même période.
    for (const route of ['ventes-par-jour', 'top-articles', 'heures-de-pointe', 'repartition']) {
      expect(lastParams(mock, route)).toMatchObject({ du: params.du, au: params.au })
    }
    expect(screen.getByRole('radio', { name: /30/ })).toBeChecked()
  })

  it("une période écrite dans l'URL est utilisée telle quelle", async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord?du=2024-06-01&au=2024-06-30')
    await ready()

    expect(lastParams(mock, 'resume')).toMatchObject({ du: '2024-06-01', au: '2024-06-30' })
    expect(screen.getByRole('radio', { name: /Personnalisé/ })).toBeChecked()
  })

  it("choisir « 7 j » met à jour l'adresse et relit les statistiques", async () => {
    mock = mockApi(base())
    const router = renderApp('/admin/tableau-de-bord')
    await ready()

    await userEvent.click(screen.getByRole('radio', { name: /7/ }))

    await waitFor(() =>
      expect(router.state.location.search).toMatch(/du=\d{4}-\d{2}-\d{2}&au=\d{4}-\d{2}-\d{2}/),
    )
    await waitFor(() => {
      const p = lastParams(mock!, 'resume')
      expect(p.du).toBe(addDays(p.au as string, -6))
    })
  })

  it('une adresse invalide est signalée et la période par défaut est affichée', async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord?du=pas-une-date')

    expect(await screen.findByText(/Période de l’adresse invalide/)).toBeInTheDocument()
    const p = lastParams(mock, 'resume')
    expect(p.du).toBe(addDays(p.au as string, -29))
  })

  it("période personnalisée inversée : message d'erreur et aucune nouvelle requête", async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord')
    await ready()
    const requestsBefore = mock.calls.length

    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))
    const from = await screen.findByLabelText('Du')
    const to = screen.getByLabelText('Au')
    await userEvent.clear(from)
    await userEvent.type(from, '2024-06-10')
    await userEvent.clear(to)
    await userEvent.type(to, '2024-06-01')
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }))

    expect(
      await screen.findByText('La date de début doit précéder la date de fin.'),
    ).toBeInTheDocument()
    expect(mock.calls.length).toBe(requestsBefore)
  })

  it('période personnalisée de plus de 366 jours : refusée côté client', async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord')
    await ready()

    await userEvent.click(screen.getByRole('radio', { name: /Personnalisé/ }))
    const from = await screen.findByLabelText('Du')
    const to = screen.getByLabelText('Au')
    await userEvent.clear(from)
    await userEvent.type(from, '2022-01-01')
    await userEvent.clear(to)
    await userEvent.type(to, '2024-06-01')
    await userEvent.click(screen.getByRole('button', { name: 'Appliquer' }))

    expect(
      await screen.findByText('La période ne peut pas dépasser 366 jours.'),
    ).toBeInTheDocument()
  })
})

describe('indicateurs et variations', () => {
  it('affiche les six indicateurs avec flèche, pourcentage et texte (jamais la couleur seule)', async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord?du=2024-06-01&au=2024-06-30')
    await ready()

    for (const label of [
      'Chiffre d’affaires',
      'Commandes',
      'Panier moyen',
      'Annulations',
      'À encaisser',
      'Nouveaux clients',
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
    }
    const revenue = screen.getByRole('group', {
      name: /Chiffre d’affaires : .*1\s?240,50.*en hausse de \+?12,5/,
    })
    expect(within(revenue).getByText(/↑/)).toBeInTheDocument()
    expect(within(revenue).getByText(/12,5/)).toBeInTheDocument()
    expect(within(revenue).getByText(/vs période précédente/)).toBeInTheDocument()

    const average = screen.getByRole('group', { name: /Panier moyen : .*en baisse/ })
    expect(within(average).getByText(/↓/)).toBeInTheDocument()
  })

  it('variation indéfinie (période précédente à 0) : « pas de comparaison », pas de pourcentage', async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord?du=2024-06-01&au=2024-06-30')
    await ready()

    const toCollect = screen.getByRole('group', { name: /À encaisser : .*pas de comparaison/ })
    expect(within(toCollect).getByText(/pas de comparaison/)).toBeInTheDocument()
    expect(within(toCollect).queryByText(/%/)).not.toBeInTheDocument()
  })

  it('variation nulle : « stable »', async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord?du=2024-06-01&au=2024-06-30')
    await ready()

    expect(screen.getByRole('group', { name: /Nouveaux clients : .*stable/ })).toBeInTheDocument()
  })
})

describe("états de chargement, d'erreur et vide", () => {
  it('chargement : des squelettes sont affichés avant les données', async () => {
    mock = mockApi(
      base({ 'GET /api/admin/statistiques/resume': () => new Promise(() => {}) as never }),
    )
    renderApp('/admin/tableau-de-bord')

    const placeholders = await screen.findAllByLabelText('Chargement…')
    expect(placeholders.length).toBeGreaterThan(0)
    expect(screen.queryByText('Pas encore de ventes sur cette période')).not.toBeInTheDocument()
  })

  it('une section en erreur ne casse pas le reste, affiche HTTP et la référence, et propose Réessayer', async () => {
    let healthy = false
    mock = mockApi(
      base({
        'GET /api/admin/statistiques/top-articles': () =>
          healthy
            ? { data: top }
            : { status: 500, data: { title: 'Erreur', correlationId: 'req-7f3a9c21' } },
      }),
    )
    renderApp('/admin/tableau-de-bord?du=2024-06-01&au=2024-06-30')

    expect(await screen.findByText(/HTTP 500/)).toBeInTheDocument()
    expect(screen.getByText(/Réf\. req-7f3a9c21/)).toBeInTheDocument()
    // Les autres sections s'affichent normalement.
    expect(screen.getByRole('group', { name: /^Chiffre d’affaires :/ })).toBeInTheDocument()
    expect(screen.getAllByText('Heures de pointe').length).toBeGreaterThan(0)

    healthy = true
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect((await screen.findAllByText('Articles les plus vendus')).length).toBeGreaterThan(0)
    await waitFor(() => expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument())
  })

  it('période sans vente : état vide, le sélecteur de période reste disponible', async () => {
    mock = mockApi(
      base({
        'GET /api/admin/statistiques/resume': () => ({
          data: resume({
            periode: values({
              chiffreAffaires: 0,
              nombreCommandes: 0,
              panierMoyen: 0,
              nombreAnnulees: 0,
              montantAEncaisser: 0,
              nouveauxClients: 0,
            }),
          }),
        }),
      }),
    )
    renderApp('/admin/tableau-de-bord?du=2000-01-01&au=2000-01-31')

    expect(await screen.findByText('Pas encore de ventes sur cette période')).toBeInTheDocument()
    expect(screen.getByRole('radiogroup', { name: 'Période' })).toBeInTheDocument()
    expect(screen.queryAllByText('Heures de pointe')).toHaveLength(0)
  })
})

describe('accessibilité des graphiques', () => {
  it('chaque graphique est une figure avec légende et un tableau de données équivalent', async () => {
    mock = mockApi(base())
    renderApp('/admin/tableau-de-bord?du=2024-06-01&au=2024-06-30')
    await ready()
    await screen.findAllByText('Heures de pointe')

    await waitFor(() =>
      expect(document.querySelectorAll('figure').length).toBeGreaterThanOrEqual(5),
    )
    document.querySelectorAll('figure').forEach((figure) => {
      expect(figure.querySelector('figcaption')).not.toBeNull()
      expect(figure.querySelector('table caption')).not.toBeNull()
    })
    // Le résumé de l'heure de pointe est exposé en texte.
    expect(screen.getAllByText(/Pointe à 20/).length).toBeGreaterThan(0)
  })
})
