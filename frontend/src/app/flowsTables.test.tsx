import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import i18n from '@/lib/i18n'
import { tokenStore } from '@/lib/tokenStore'
import type { AdminTable, SalleTable, User } from '@/lib/types'
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

const CODES = {
  1: '11111111-1111-4111-8111-111111111111',
  2: '22222222-2222-4222-8222-222222222222',
  3: '33333333-3333-4333-8333-333333333333',
  5: '55555555-5555-4555-8555-555555555555',
}

const tables: AdminTable[] = [
  { id: 1, numero: 1, code: CODES[1], capacite: 4, estActive: true },
  { id: 3, numero: 2, code: CODES[2], capacite: 2, estActive: true },
  { id: 4, numero: 3, code: CODES[3], capacite: 4, estActive: false },
  { id: 2, numero: 5, code: CODES[5], capacite: 6, estActive: true },
]

const order = (
  id: number,
  statut: SalleTable['commandes'][number]['statut'],
  estPayee: boolean,
  total: number,
) => ({
  id,
  numero: `CMD-${String(id).padStart(6, '0')}`,
  statut,
  total,
  estPayee,
  dateCommande: new Date(Date.now() - 45 * 60_000).toISOString(),
})

const salle = (): SalleTable[] => [
  {
    id: 1,
    numero: 1,
    capacite: 4,
    estActive: true,
    etat: 'Occupee',
    totalAEncaisser: 4.5,
    nombreCommandes: 2,
    premiereCommandeUtc: new Date(Date.now() - 45 * 60_000).toISOString(),
    commandes: [order(1, 'Prete', true, 7), order(2, 'EnPreparation', false, 4.5)],
  },
  {
    id: 3,
    numero: 2,
    capacite: 2,
    estActive: true,
    etat: 'Libre',
    totalAEncaisser: 0,
    nombreCommandes: 0,
    premiereCommandeUtc: null,
    commandes: [],
  },
  {
    id: 4,
    numero: 3,
    capacite: 4,
    estActive: false,
    etat: 'Inactive',
    totalAEncaisser: 5,
    nombreCommandes: 1,
    premiereCommandeUtc: new Date(Date.now() - 10 * 60_000).toISOString(),
    commandes: [order(3, 'EnAttente', false, 5)],
  },
  {
    id: 2,
    numero: 5,
    capacite: 6,
    estActive: true,
    etat: 'AEncaisser',
    totalAEncaisser: 62,
    nombreCommandes: 2,
    premiereCommandeUtc: new Date(Date.now() - 80 * 60_000).toISOString(),
    commandes: [order(4, 'Terminee', false, 40), order(5, 'Terminee', false, 22)],
  },
]

const base = (): Record<string, MockHandler> => ({
  'GET /api/auth/me': () => ({ data: admin }),
  'GET /api/restaurant': () => ({
    data: { nom: 'Chez Sami', horaires: [], ouvertMaintenant: true },
  }),
  'GET /api/admin/tables': () => ({ data: tables }),
  'GET /api/admin/tables/salle': () => ({ data: salle() }),
  'GET /api/admin/commandes/actives': () => ({ data: [] }),
  'GET /api/admin/commandes/compteurs': () => ({
    data: { date: '2024-06-01', parStatut: [], totalAujourdhui: 0, enAttente: 0 },
  }),
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

const signIn = () => tokenStore.set('jwt', new Date(Date.now() + 3_600_000).toISOString())
const card = (heading: string | RegExp) =>
  screen.getByRole('heading', { name: heading }).closest('li') as HTMLElement

const gestionCard = (numero: number) =>
  screen.getByAltText(`QR code de la table ${numero}`).closest('li') as HTMLElement

let mock: ReturnType<typeof mockApi> | undefined
beforeEach(async () => {
  await i18n.changeLanguage('fr')
  signIn()
  window.print = vi.fn()
})
afterEach(() => {
  mock?.restore()
  vi.unstubAllEnvs()
})

describe('/admin/tables : onglets', () => {
  it('la salle est la vue par défaut ; ?vue=gestion ouvre la gestion', async () => {
    mock = mockApi(base())
    renderApp('/admin/tables')
    expect(await screen.findByRole('tab', { name: 'Salle', selected: true })).toBeInTheDocument()
    expect(await screen.findByText('Aucune commande en cours')).toBeInTheDocument()
  })

  it('?vue=gestion affiche la gestion avec les QR', async () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://resto.example.tn')
    mock = mockApi(base())
    renderApp('/admin/tables?vue=gestion')
    expect(await screen.findByRole('tab', { name: 'Gestion', selected: true })).toBeInTheDocument()
    expect(await screen.findByAltText('QR code de la table 1')).toBeInTheDocument()
  })
})

describe('Salle : états', () => {
  it('affiche les quatre états avec un libellé texte, le total à encaisser et le résumé', async () => {
    mock = mockApi(base())
    renderApp('/admin/tables')
    await screen.findByRole('heading', { name: /Table 5/ })

    expect(within(card(/Table 1$/)).getByText('Occupée')).toBeInTheDocument()
    expect(within(card(/Table 2$/)).getByText('Libre')).toBeInTheDocument()
    expect(within(card(/Table 3$/)).getByText('Inactive')).toBeInTheDocument()
    const due = card(/Table 5$/)
    expect(within(due).getAllByText('À encaisser').length).toBeGreaterThan(0)
    expect(within(due).getByText(/62,00/)).toBeInTheDocument()
    // Table inactive : aucune action, renvoi vers Gestion.
    expect(
      within(card(/Table 3$/)).queryByRole('button', { name: 'Encaisser' }),
    ).not.toBeInTheDocument()
    expect(
      within(card(/Table 3$/)).queryByRole('button', { name: 'Libérer' }),
    ).not.toBeInTheDocument()
    expect(
      within(card(/Table 3$/)).getByRole('button', { name: /Aller à Gestion/ }),
    ).toBeInTheDocument()
    // Résumé en tête : compteurs de tables libres / occupées / à encaisser.
    expect(screen.getAllByText(/tables? libres?/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/tables? occupées?/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/tables? à encaisser/i).length).toBeGreaterThan(0)
  })
})

describe('Salle : encaisser et libérer', () => {
  it("encaisser : la confirmation affiche le montant, rien n'est envoyé avant de confirmer", async () => {
    let paid = false
    mock = mockApi({
      ...base(),
      'GET /api/admin/tables/salle': () => ({
        data: salle().map((t) =>
          t.id === 2 && paid
            ? {
                ...t,
                etat: 'Libre',
                totalAEncaisser: 0,
                nombreCommandes: 0,
                commandes: [],
                premiereCommandeUtc: null,
              }
            : t,
        ),
      }),
      'POST /api/admin/tables/2/encaisser': () => {
        paid = true
        return {
          data: {
            ...salle()[3]!,
            etat: 'Libre',
            totalAEncaisser: 0,
            nombreCommandes: 0,
            commandes: [],
            premiereCommandeUtc: null,
          },
        }
      },
    })
    renderApp('/admin/tables')
    await screen.findByRole('heading', { name: /Table 5/ })

    await userEvent.click(within(card(/Table 5$/)).getByRole('button', { name: 'Encaisser' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getAllByText(/62,00/).length).toBeGreaterThan(0)
    expect(within(dialog).getByText(/2 commandes seront marquées comme payées/)).toBeInTheDocument()
    expect(mock.calls.some((c) => c.method === 'post')).toBe(false)

    await userEvent.click(within(dialog).getByRole('button', { name: /Encaisser .*62,00/ }))

    await waitFor(() =>
      expect(mock!.calls.some((c) => c.url === '/api/admin/tables/2/encaisser')).toBe(true),
    )
    expect(await screen.findByText(/Table 5 encaissée/)).toBeInTheDocument()
  })

  it('encaisser refusé (409) : le message du serveur reste visible dans le dialogue', async () => {
    mock = mockApi({
      ...base(),
      'POST /api/admin/tables/2/encaisser': () => ({
        status: 409,
        data: { title: "La table n° 5 n'a rien à encaisser." },
      }),
    })
    renderApp('/admin/tables')
    await screen.findByRole('heading', { name: /Table 5/ })

    await userEvent.click(within(card(/Table 5$/)).getByRole('button', { name: 'Encaisser' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Encaisser .*62,00/ }))

    expect(await within(dialog).findByText(/n'a rien à encaisser/)).toBeInTheDocument()
  })

  it('libérer bloqué : explique les blocages et affiche le 409 du serveur sans échec silencieux', async () => {
    mock = mockApi({
      ...base(),
      'POST /api/admin/tables/1/liberer': () => ({
        status: 409,
        data: {
          title:
            "Impossible de libérer la table n° 1 : 1 commande(s) en attente ou en préparation (terminez-les ou annulez-les d'abord) ; 1 commande(s) non encaissée(s) (encaissez d'abord).",
        },
      }),
    })
    renderApp('/admin/tables')
    await screen.findByRole('heading', { name: /Table 1$/ })

    await userEvent.click(within(card(/Table 1$/)).getByRole('button', { name: 'Libérer' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/1 commande en cours/)).toBeInTheDocument()
    expect(within(dialog).getByText(/1 commande non encaissée/)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Libérer la table' }))

    expect(
      await within(dialog).findByText(/Impossible de libérer la table n° 1/),
    ).toBeInTheDocument()
  })

  it('libérer réussi : la table redevient libre', async () => {
    let freed = false
    const free = {
      ...salle()[0]!,
      etat: 'Libre' as const,
      totalAEncaisser: 0,
      nombreCommandes: 0,
      commandes: [],
      premiereCommandeUtc: null,
    }
    mock = mockApi({
      ...base(),
      'GET /api/admin/tables/salle': () => ({
        data: salle().map((t) =>
          t.id === 1 && freed
            ? free
            : t.id === 1
              ? {
                  ...t,
                  commandes: [order(1, 'Prete', true, 7)],
                  etat: 'Occupee',
                  totalAEncaisser: 0,
                  nombreCommandes: 1,
                }
              : t,
        ),
      }),
      'POST /api/admin/tables/1/liberer': () => {
        freed = true
        return { data: free }
      },
    })
    renderApp('/admin/tables')
    await screen.findByRole('heading', { name: /Table 1$/ })

    await userEvent.click(within(card(/Table 1$/)).getByRole('button', { name: 'Libérer' }))
    await userEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Libérer la table' }),
    )

    expect(await screen.findByText('Table 1 libérée.')).toBeInTheDocument()
    await waitFor(() => expect(within(card(/Table 1$/)).getByText('Libre')).toBeInTheDocument())
  })
})

describe('Gestion', () => {
  const gestion = () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'https://resto.example.tn')
  }

  it("avertit visiblement quand l'adresse des QR contient « localhost »", async () => {
    vi.stubEnv('VITE_PUBLIC_URL', 'http://localhost:5173')
    mock = mockApi(base())
    renderApp('/admin/tables?vue=gestion')

    expect(
      await screen.findByText('À remplacer par l’adresse du site avant impression'),
    ).toBeInTheDocument()
  })

  it("aucun avertissement avec une adresse publique, et l'URL complète est affichée sous le QR", async () => {
    gestion()
    mock = mockApi(base())
    renderApp('/admin/tables?vue=gestion')

    // L'URL est affichée sous le QR (et reprise dans la feuille d'impression, masquée à l'écran).
    expect(
      (await screen.findAllByText(`https://resto.example.tn/table/${CODES[1]}`)).length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByText('À remplacer par l’adresse du site avant impression'),
    ).not.toBeInTheDocument()
  })

  it('ajout : numéro automatique, capacité envoyée, nouvelle table confirmée', async () => {
    gestion()
    let body: unknown
    mock = mockApi({
      ...base(),
      'POST /api/admin/tables': (config) => {
        body = JSON.parse(String(config.data))
        return {
          status: 201,
          data: { id: 9, numero: 6, code: CODES[1], capacite: 4, estActive: true },
        }
      },
    })
    renderApp('/admin/tables?vue=gestion')

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une table' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: /Ajouter|Enregistrer|Créer/ }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({ capacite: 4 }) // numéro vide = automatique, jamais envoyé
    expect(await screen.findByText('Table ajoutée.')).toBeInTheDocument()
  })

  it('numéro déjà pris (409) : message sous le champ Numéro', async () => {
    gestion()
    mock = mockApi({
      ...base(),
      'POST /api/admin/tables': () => ({
        status: 409,
        data: { title: 'La table n° 1 existe déjà.' },
      }),
    })
    renderApp('/admin/tables?vue=gestion')

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une table' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Numéro/), '1')
    await userEvent.click(within(dialog).getByRole('button', { name: /Ajouter|Enregistrer|Créer/ }))

    expect(await within(dialog).findByText('Ce numéro est déjà utilisé.')).toBeInTheDocument()
    expect(within(dialog).getByLabelText(/^Numéro/)).toHaveAttribute('aria-invalid', 'true')
  })

  it('numéro et capacité hors limites : refusés côté client sans appel', async () => {
    gestion()
    mock = mockApi(base())
    renderApp('/admin/tables?vue=gestion')

    await userEvent.click(await screen.findByRole('button', { name: 'Ajouter une table' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Numéro/), '0')
    const capacity = within(dialog).getByLabelText(/^Capacité/)
    await userEvent.clear(capacity)
    await userEvent.type(capacity, '51')
    await userEvent.click(within(dialog).getByRole('button', { name: /Ajouter|Enregistrer|Créer/ }))

    await waitFor(() =>
      expect(within(dialog).getByLabelText(/^Numéro/)).toHaveAttribute('aria-invalid', 'true'),
    )
    expect(capacity).toHaveAttribute('aria-invalid', 'true')
    expect(mock.calls.some((c) => c.method === 'post')).toBe(false)
  })

  it('désactivation : confirmation obligatoire avant tout envoi', async () => {
    gestion()
    mock = mockApi({
      ...base(),
      'PATCH /api/admin/tables/1/active': () => ({ data: { ...tables[0], estActive: false } }),
    })
    renderApp('/admin/tables?vue=gestion')

    await screen.findByAltText('QR code de la table 1')
    await userEvent.click(within(gestionCard(1)).getByRole('button', { name: 'Désactiver' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/Les clients ne pourront plus commander sur place avec ce QR/),
    ).toBeInTheDocument()
    expect(mock.calls.some((c) => c.method === 'patch')).toBe(false)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Désactiver' }))

    await waitFor(() => {
      const patch = mock!.calls.find((c) => c.method === 'patch')
      expect(JSON.parse(String(patch?.data))).toEqual({ estActive: false })
    })
  })

  it('régénération : avertissement explicite, envoi seulement après confirmation', async () => {
    gestion()
    mock = mockApi({
      ...base(),
      'POST /api/admin/tables/1/regenerer-code': () => ({
        data: { ...tables[0], code: '99999999-9999-4999-8999-999999999999' },
      }),
    })
    renderApp('/admin/tables?vue=gestion')

    await screen.findByAltText('QR code de la table 1')
    await userEvent.click(within(gestionCard(1)).getByRole('button', { name: 'Régénérer le code' }))
    const dialog = await screen.findByRole('dialog')
    expect(
      within(dialog).getByText(/Les anciens QR imprimés ne fonctionneront plus/),
    ).toBeInTheDocument()
    expect(mock.calls.some((c) => c.method === 'post')).toBe(false)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Régénérer le code' }))

    await waitFor(() =>
      expect(mock!.calls.some((c) => c.url === '/api/admin/tables/1/regenerer-code')).toBe(true),
    )
  })

  it("l'impression ne contient que les tables actives, une fiche par table", async () => {
    gestion()
    mock = mockApi(base())
    renderApp('/admin/tables?vue=gestion')
    await screen.findByAltText('QR code de la table 1')

    const sheet = await waitFor(() => {
      const el = document.querySelector('[data-print-sheet]')
      expect(el).not.toBeNull()
      return el as HTMLElement
    })
    await waitFor(() => expect(sheet.querySelectorAll('[data-print-table]').length).toBe(3))

    const numbers = [...sheet.querySelectorAll('[data-print-table]')].map((s) =>
      s.getAttribute('data-print-table'),
    )
    expect(numbers).toEqual(['1', '2', '5']) // la table 3 est inactive : absente
    expect(sheet.textContent).toContain('Scannez pour commander')
    expect(sheet.textContent).toContain('امسح الكود وأطلب من طاولتك')
    expect(sheet.textContent).toContain('Chez Sami')
    expect(sheet.textContent).not.toContain('À remplacer par l’adresse') // l'avertissement n'est pas imprimé
  })

  it("« Imprimer toutes » lance l'impression ; une table inactive ne peut pas être imprimée", async () => {
    gestion()
    mock = mockApi(base())
    renderApp('/admin/tables?vue=gestion')
    await screen.findByAltText('QR code de la table 1')

    expect(within(gestionCard(3)).getByRole('button', { name: 'Imprimer' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )
    const all = await screen.findByRole('button', { name: 'Imprimer toutes les tables' })
    await waitFor(() => expect(all).not.toHaveAttribute('aria-disabled', 'true'))
    await userEvent.click(all)

    await waitFor(() => expect(window.print).toHaveBeenCalledTimes(1))
  })
})

describe('Accueil', () => {
  it("n'affiche plus de bouton « Réserver »", async () => {
    mock = mockApi({
      'GET /api/restaurant': () => ({ status: 500, data: {} }),
      'GET /api/menu': () => ({ data: [] }),
    })
    renderApp('/')

    expect((await screen.findAllByRole('link', { name: /Voir le menu/ })).length).toBeGreaterThan(0)
    expect(screen.queryByText(/Réserver/)).not.toBeInTheDocument()
  })
})
