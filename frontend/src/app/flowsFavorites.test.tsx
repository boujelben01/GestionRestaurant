import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { RouterProvider, createMemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ArticleCard } from '@/features/menu/ArticleCard'
import i18n from '@/lib/i18n'
import { tokenStore } from '@/lib/tokenStore'
import type {
  Address,
  FavoriteArticle,
  MenuArticle,
  MenuCategorie,
  Panier,
  Restaurant,
  User,
} from '@/lib/types'
import { mockApi, type MockHandler } from '@/test/mockApi'
import { Providers } from './providers'
import { routes } from './router'

const client: User = {
  id: 'u-client',
  userName: 'client',
  nom: 'Yazid',
  email: 'client@example.com',
  telephone: '+21620123456',
  roles: ['Client'],
  langueFavorite: 'fr',
}
const admin: User = { ...client, id: 'u-admin', userName: 'admin', nom: 'Admin', roles: ['Admin'] }

const article = (id: number, nom: string, over: Partial<MenuArticle> = {}): MenuArticle => ({
  id,
  categorieId: 1,
  nom,
  description: null,
  prix: 4.5,
  imageUrl: null,
  estPopulaire: true,
  disponible: true,
  ...over,
})

const menu: MenuCategorie[] = [
  {
    id: 1,
    nom: 'Entrées',
    ordre: 1,
    articles: [article(101, 'Brik à l’œuf'), article(102, 'Salade méchouia')],
  },
]

const favorite = (
  id: number,
  nom: string,
  over: Partial<FavoriteArticle> = {},
): FavoriteArticle => ({
  id,
  categorieId: 1,
  nom,
  description: null,
  prix: 4.5,
  imageUrl: null,
  estPopulaire: false,
  disponible: true,
  actif: true,
  ...over,
})

const address = (id: number, libelle: string, over: Partial<Address> = {}): Address => ({
  id,
  libelle,
  ligne: `${id} rue de la Liberté`,
  ville: 'Tunis',
  details: null,
  telephone: `+2162000000${id}`,
  estParDefaut: false,
  ...over,
})

const emptyCart: Panier = { lignes: [], nombreArticles: 0, sousTotal: 0, dateMiseAJour: null }

const base = (
  user: User = client,
  over: Record<string, MockHandler> = {},
): Record<string, MockHandler> => ({
  'GET /api/auth/me': () => ({ data: user }),
  'GET /api/restaurant': () => ({ status: 500, data: {} }),
  'GET /api/menu': () => ({ data: menu }),
  'GET /api/panier': () => ({ data: emptyCart }),
  'GET /api/favoris/ids': () => ({ data: [] }),
  'GET /api/favoris': () => ({ data: [] }),
  'GET /api/adresses': () => ({ data: [] }),
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

const signIn = () => tokenStore.set('jwt', new Date(Date.now() + 3_600_000).toISOString())

let mock: ReturnType<typeof mockApi> | undefined
beforeEach(async () => {
  await i18n.changeLanguage('fr')
})
afterEach(() => mock?.restore())

describe('ArticleCard reste pure', () => {
  const render1 = (props: Partial<React.ComponentProps<typeof ArticleCard>> = {}) =>
    render(<ArticleCard article={article(1, 'Brik')} {...props} />)

  it("sans onToggleFavorite, aucun cœur n'est rendu", () => {
    render1()
    expect(screen.queryByRole('button', { name: /favoris/ })).not.toBeInTheDocument()
  })

  it('avec onToggleFavorite : cœur aria-pressed qui reflète isFavorite et appelle le gestionnaire', async () => {
    const onToggle = vi.fn()
    const { rerender } = render(
      <ArticleCard article={article(1, 'Brik')} onToggleFavorite={onToggle} isFavorite={false} />,
    )
    const heart = screen.getByRole('button', { name: 'Ajouter aux favoris : Brik' })
    expect(heart).toHaveAttribute('aria-pressed', 'false')

    await userEvent.click(heart)
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }))

    rerender(<ArticleCard article={article(1, 'Brik')} onToggleFavorite={onToggle} isFavorite />)
    expect(screen.getByRole('button', { name: 'Retirer des favoris : Brik' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('un article retiré du menu est grisé et signalé', () => {
    render(
      <ArticleCard article={article(1, 'Brik')} unlisted onToggleFavorite={vi.fn()} isFavorite />,
    )
    expect(screen.getByText('Plus disponible au menu')).toBeInTheDocument()
  })
})

describe('cœur sur le menu', () => {
  it('invité : le clic mène à /connexion avec retour sur le menu', async () => {
    mock = mockApi(base())
    const router = renderApp('/menu')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ajouter aux favoris : Brik à l’œuf' }),
    )

    await waitFor(() => expect(router.state.location.pathname).toBe('/connexion'))
    expect(router.state.location.state).toEqual({ from: '/menu' })
    expect(mock.calls.some((c) => c.url?.startsWith('/api/favoris'))).toBe(false)
  })

  it('client : le cœur est coché tout de suite (optimiste) puis confirmé par le serveur', async () => {
    signIn()
    let release: () => void = () => {}
    const gate = new Promise<void>((r) => (release = r))
    let ids: number[] = []
    mock = mockApi(
      base(client, {
        'GET /api/favoris/ids': () => ({ data: ids }),
        'PUT /api/favoris/102': async () => {
          await gate
          ids = [102]
          return { status: 204 }
        },
      }),
    )
    renderApp('/menu')

    const heart = await screen.findByRole('button', {
      name: 'Ajouter aux favoris : Salade méchouia',
    })
    expect(heart).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(heart)

    // Avant la réponse du serveur : déjà coché.
    expect(
      await screen.findByRole('button', { name: 'Retirer des favoris : Salade méchouia' }),
    ).toHaveAttribute('aria-pressed', 'true')
    release()
    await waitFor(() =>
      expect(mock!.calls.some((c) => c.method === 'put' && c.url === '/api/favoris/102')).toBe(
        true,
      ),
    )
    expect(await screen.findByText('Salade méchouia ajouté aux favoris')).toBeInTheDocument()
  })

  it("client : un favori existant s'affiche coché et se retire", async () => {
    signIn()
    let ids = [101]
    mock = mockApi(
      base(client, {
        'GET /api/favoris/ids': () => ({ data: ids }),
        'DELETE /api/favoris/101': () => {
          ids = []
          return { status: 204 }
        },
      }),
    )
    renderApp('/menu')

    const heart = await screen.findByRole('button', { name: 'Retirer des favoris : Brik à l’œuf' })
    expect(heart).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(heart)

    expect(
      await screen.findByRole('button', { name: 'Ajouter aux favoris : Brik à l’œuf' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(mock.calls.some((c) => c.method === 'delete' && c.url === '/api/favoris/101')).toBe(true)
  })

  it("refus du serveur (404) : retour arrière du cœur et message d'erreur", async () => {
    signIn()
    mock = mockApi(
      base(client, {
        'PUT /api/favoris/102': () => ({ status: 404, data: { title: 'Article introuvable.' } }),
      }),
    )
    renderApp('/menu')

    await userEvent.click(
      await screen.findByRole('button', { name: 'Ajouter aux favoris : Salade méchouia' }),
    )

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Ajouter aux favoris : Salade méchouia' }),
      ).toHaveAttribute('aria-pressed', 'false'),
    )
  })

  it("un administrateur ne voit aucun cœur et aucune requête de favoris n'est faite", async () => {
    signIn()
    mock = mockApi(base(admin))
    renderApp('/menu')

    await screen.findAllByRole('button', { name: /Ajouter .* au panier/ })
    expect(screen.queryByRole('button', { name: /favoris/ })).not.toBeInTheDocument()
    expect(mock.calls.some((c) => c.url?.startsWith('/api/favoris'))).toBe(false)
  })
})

describe('/favoris', () => {
  it('liste les favoris, grise un article retiré du menu et signale un article indisponible', async () => {
    signIn()
    mock = mockApi(
      base(client, {
        'GET /api/favoris': () => ({
          data: [
            favorite(303, 'Kamounia', { disponible: false }),
            favorite(201, 'Makloub thon', { actif: false }),
            favorite(101, 'Brik à l’œuf'),
          ],
        }),
        'GET /api/favoris/ids': () => ({ data: [303, 201, 101] }),
      }),
    )
    renderApp('/favoris')

    expect(await screen.findByText('Kamounia')).toBeInTheDocument()
    expect(screen.getByText('3 plats favoris')).toBeInTheDocument()
    expect(screen.getByText('Plus disponible au menu')).toBeInTheDocument()
    expect(screen.getAllByText('Indisponible').length).toBeGreaterThan(0)
    // Le cœur d'un article retiré du menu permet de le retirer des favoris.
    expect(
      screen.getByRole('button', { name: 'Retirer des favoris : Makloub thon' }),
    ).toBeInTheDocument()
    const inactiveCard = screen.getByText('Makloub thon').closest('article') as HTMLElement
    expect(
      within(inactiveCard).getByRole('button', { name: /Ajouter Makloub thon au panier/ }),
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('état vide soigné avec un lien vers le menu', async () => {
    signIn()
    mock = mockApi(base())
    renderApp('/favoris')

    expect(await screen.findByText('Aucun favori pour l’instant')).toBeInTheDocument()
    // En-tête et pied de page ont aussi un lien vers le menu : on cible celui de l'état vide (zone principale).
    expect(within(screen.getByRole('main')).getByRole('link', { name: /menu/i })).toHaveAttribute(
      'href',
      '/menu',
    )
  })

  it('erreur de chargement : message et bouton Réessayer', async () => {
    signIn()
    mock = mockApi(
      base(client, { 'GET /api/favoris': () => ({ status: 500, data: { title: 'Erreur' } }) }),
    )
    renderApp('/favoris')

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })

  it("invité : redirigé vers la connexion ; administrateur : renvoyé vers l'administration", async () => {
    mock = mockApi(base())
    const guest = renderApp('/favoris')
    await waitFor(() => expect(guest.state.location.pathname).toBe('/connexion'))
    mock.restore()

    signIn()
    mock = mockApi({
      ...base(admin),
      'GET /api/admin/statistiques/resume': () => ({ status: 500, data: {} }),
    })
    const adminRouter = renderApp('/favoris')
    await waitFor(() => expect(adminRouter.state.location.pathname).toMatch(/^\/admin/))
    expect(mock.calls.some((c) => c.url?.startsWith('/api/favoris'))).toBe(false)
  })
})

describe('accueil : « Vos plats favoris »', () => {
  const home = async (user: User | null, favorites: FavoriteArticle[]) => {
    if (user) signIn()
    mock = mockApi(
      base(user ?? client, {
        'GET /api/favoris': () => ({ data: favorites }),
        'GET /api/favoris/ids': () => ({ data: favorites.map((f) => f.id) }),
      }),
    )
    renderApp('/')
    await screen.findAllByRole('link', { name: /Voir le menu/ })
  }

  it('affiché pour un client qui a des favoris actifs', async () => {
    await home(client, [favorite(101, 'Brik à l’œuf'), favorite(102, 'Salade méchouia')])

    expect(await screen.findByText('Vos plats favoris')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voir tous mes favoris' })).toHaveAttribute(
      'href',
      '/favoris',
    )
  })

  it("absent s'il n'y a que des favoris désactivés, ou aucun", async () => {
    await home(client, [favorite(201, 'Makloub thon', { actif: false })])

    await waitFor(() => expect(mock!.calls.some((c) => c.url === '/api/favoris')).toBe(true))
    expect(screen.queryByText('Vos plats favoris')).not.toBeInTheDocument()
  })

  it('absent pour un invité et pour un administrateur, sans requête de favoris', async () => {
    await home(null, [favorite(101, 'Brik à l’œuf')])
    expect(screen.queryByText('Vos plats favoris')).not.toBeInTheDocument()
    expect(mock!.calls.some((c) => c.url?.startsWith('/api/favoris'))).toBe(false)
  })
})

describe('profil : Mes adresses', () => {
  const profile = async (
    addresses: Address[],
    over: Record<string, MockHandler> = {},
    user: User = client,
  ) => {
    signIn()
    mock = mockApi(base(user, { 'GET /api/adresses': () => ({ data: addresses }), ...over }))
    renderApp('/profil')
  }

  it('liste les adresses avec le badge « Par défaut » et le compteur', async () => {
    await profile([address(1, 'Maison', { estParDefaut: true }), address(2, 'Bureau')])

    expect(await screen.findByText('Maison')).toBeInTheDocument()
    expect(screen.getByText('Bureau')).toBeInTheDocument()
    expect(screen.getAllByText('Par défaut').length).toBeGreaterThan(0)
    expect(screen.getByText('2 / 10 adresses')).toBeInTheDocument()
  })

  it('état vide avec un bouton pour ajouter', async () => {
    await profile([])

    expect(await screen.findByText('Aucune adresse enregistrée')).toBeInTheDocument()
  })

  it('ajout : validation côté client sans appel, puis envoi des valeurs rognées', async () => {
    let body: unknown
    await profile([], {
      'POST /api/adresses': (config) => {
        body = JSON.parse(String(config.data))
        return { status: 201, data: address(1, 'Maison', { estParDefaut: true }) }
      },
    })

    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Ajouter une adresse' }))[0]!,
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(await within(dialog).findAllByText('Ce champ est obligatoire.')).not.toHaveLength(0)
    expect(mock!.calls.some((c) => c.method === 'post')).toBe(false)

    await userEvent.type(within(dialog).getByLabelText(/^Libellé/), '  Maison ')
    await userEvent.type(within(dialog).getByLabelText(/^Adresse$/), '12 rue de la Liberté')
    await userEvent.type(within(dialog).getByLabelText(/^Ville/), 'Tunis')
    await userEvent.type(within(dialog).getByLabelText(/^Téléphone/), '+21620123456')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(body).toBeDefined())
    // Première adresse du carnet : la case « par défaut » est cochée d'office (règle du serveur, AdresseService).
    expect(body).toEqual({
      libelle: 'Maison',
      ligne: '12 rue de la Liberté',
      ville: 'Tunis',
      details: null,
      telephone: '+21620123456',
      estParDefaut: true,
    })
  })

  it("ajout quand une adresse existe déjà : la case « par défaut » n'est pas cochée d'office", async () => {
    let body: unknown
    await profile([address(1, 'Maison', { estParDefaut: true })], {
      'POST /api/adresses': (config) => {
        body = JSON.parse(String(config.data))
        return { status: 201, data: address(2, 'Bureau') }
      },
    })

    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Ajouter une adresse' }))[0]!,
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Libellé/), ' Bureau  ')
    await userEvent.type(within(dialog).getByLabelText(/^Adresse$/), '5 avenue Habib Bourguiba')
    await userEvent.type(within(dialog).getByLabelText(/^Ville/), 'Tunis')
    await userEvent.type(within(dialog).getByLabelText(/^Téléphone/), '+21698765432')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    await waitFor(() => expect(body).toBeDefined())
    expect(body).toEqual({
      libelle: 'Bureau',
      ligne: '5 avenue Habib Bourguiba',
      ville: 'Tunis',
      details: null,
      telephone: '+21698765432',
      estParDefaut: false,
    })
  })

  it('409 du serveur (limite atteinte) : message explicite dans le dialogue', async () => {
    await profile([address(1, 'Maison', { estParDefaut: true })], {
      'POST /api/adresses': () => ({
        status: 409,
        data: { title: 'Vous ne pouvez pas enregistrer plus de 10 adresses.' },
      }),
    })

    await userEvent.click(
      (await screen.findAllByRole('button', { name: 'Ajouter une adresse' }))[0]!,
    )
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText(/^Libellé/), 'Bureau')
    await userEvent.type(within(dialog).getByLabelText(/^Adresse$/), '5 avenue Habib Bourguiba')
    await userEvent.type(within(dialog).getByLabelText(/^Ville/), 'Tunis')
    await userEvent.type(within(dialog).getByLabelText(/^Téléphone/), '+21620123456')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByText(/limite de 10 adresses/)).toBeInTheDocument()
  })

  it("à 10 adresses, l'ajout est désactivé avec une explication", async () => {
    await profile(
      Array.from({ length: 10 }, (_, i) =>
        address(i + 1, `Adresse ${i + 1}`, { estParDefaut: i === 0 }),
      ),
    )

    expect(await screen.findByText('10 / 10 adresses')).toBeInTheDocument()
    const add = screen.getAllByRole('button', { name: 'Ajouter une adresse' })[0]!
    expect(add).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByText(/limite de 10 adresses/)).toBeInTheDocument()
    await userEvent.click(add)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('suppression : confirmation obligatoire, puis suppression réelle', async () => {
    await profile([address(1, 'Maison', { estParDefaut: true }), address(2, 'Bureau')], {
      'DELETE /api/adresses/2': () => ({ status: 204 }),
    })

    const card = (await screen.findByText('Bureau')).closest('li') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: /Supprimer/ }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText('Supprimer cette adresse ?')).toBeInTheDocument()
    expect(mock!.calls.some((c) => c.method === 'delete')).toBe(false)

    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer' }))

    await waitFor(() =>
      expect(mock!.calls.some((c) => c.method === 'delete' && c.url === '/api/adresses/2')).toBe(
        true,
      ),
    )
  })

  it("supprimer l'adresse par défaut avertit que la plus ancienne la remplacera", async () => {
    await profile([address(1, 'Maison', { estParDefaut: true }), address(2, 'Bureau')])

    const card = (await screen.findByText('Maison')).closest('li') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: /Supprimer/ }))

    expect(
      await within(await screen.findByRole('dialog')).findByText(/par défaut/),
    ).toBeInTheDocument()
  })

  it('« Définir par défaut » envoie le PATCH', async () => {
    await profile([address(1, 'Maison', { estParDefaut: true }), address(2, 'Bureau')], {
      'PATCH /api/adresses/2/defaut': () => ({
        data: address(2, 'Bureau', { estParDefaut: true }),
      }),
    })

    const card = (await screen.findByText('Bureau')).closest('li') as HTMLElement
    await userEvent.click(within(card).getByRole('button', { name: /Définir par défaut/ }))

    await waitFor(() =>
      expect(
        mock!.calls.some((c) => c.method === 'patch' && c.url === '/api/adresses/2/defaut'),
      ).toBe(true),
    )
  })

  it("un administrateur ne voit pas la section et aucune requête d'adresses n'est faite", async () => {
    await profile([], {}, admin)

    await screen.findByText('Mon profil')
    expect(screen.queryByText('Mes adresses')).not.toBeInTheDocument()
    expect(mock!.calls.some((c) => c.url?.startsWith('/api/adresses'))).toBe(false)
  })
})

describe('commande en livraison : adresses enregistrées', () => {
  const restaurant = {
    nom: 'Resto',
    telephone: '+216 71 000 000',
    email: 'c@r.tn',
    adresse: 'Tunis',
    fraisLivraison: 3,
    montantMinimumLivraison: 20,
    commandesOuvertes: true,
    ouvertMaintenant: true,
    horaires: [],
  } as Restaurant

  const checkout = async (addresses: Address[], user: User = client) => {
    signIn()
    mock = mockApi(
      base(user, {
        'GET /api/restaurant': () => ({ data: restaurant }),
        'GET /api/panier': () => ({
          data: {
            lignes: [
              {
                articleId: 101,
                nom: 'Brik',
                prixUnitaire: 25,
                imageUrl: null,
                disponible: true,
                quantite: 1,
                totalLigne: 25,
                avertissement: null,
              },
            ],
            nombreArticles: 1,
            sousTotal: 25,
            dateMiseAJour: null,
          },
        }),
        'GET /api/adresses': () => ({ data: addresses }),
      }),
    )
    renderApp('/commande')
    await userEvent.click(await screen.findByLabelText(/Livraison/))
  }

  const trio = [
    address(1, 'Maison', { estParDefaut: true, details: '2e étage' }),
    address(2, 'Bureau', { telephone: '+21698765432' }),
  ]

  it("l'adresse par défaut est présélectionnée et préremplit adresse et téléphone", async () => {
    await checkout(trio)

    const group = await screen.findByRole('radiogroup', { name: 'Mes adresses' })
    expect(within(group).getByRole('radio', { name: /Maison/ })).toBeChecked()
    expect(await screen.findByLabelText(/Adresse de livraison/)).toHaveValue(
      '1 rue de la Liberté, Tunis, 2e étage',
    )
    expect(screen.getByLabelText(/Téléphone/)).toHaveValue('+21620000001')
  })

  it('choisir une autre adresse remplace adresse et téléphone ; « Autre adresse » vide le champ', async () => {
    await checkout(trio)
    const group = await screen.findByRole('radiogroup', { name: 'Mes adresses' })

    await userEvent.click(within(group).getByRole('radio', { name: /Bureau/ }))
    expect(screen.getByLabelText(/Adresse de livraison/)).toHaveValue('2 rue de la Liberté, Tunis')
    expect(screen.getByLabelText(/Téléphone/)).toHaveValue('+21698765432')

    await userEvent.click(within(group).getByRole('radio', { name: 'Autre adresse' }))
    expect(screen.getByLabelText(/Adresse de livraison/)).toHaveValue('')
  })

  it('sans adresse enregistrée, le formulaire se comporte comme avant (saisie libre)', async () => {
    await checkout([])

    expect(await screen.findByLabelText(/Adresse de livraison/)).toHaveValue('')
    expect(screen.queryByRole('radiogroup', { name: 'Mes adresses' })).not.toBeInTheDocument()
  })

  it('si les adresses ne se chargent pas, la saisie libre reste possible', async () => {
    signIn()
    mock = mockApi(
      base(client, {
        'GET /api/restaurant': () => ({ data: restaurant }),
        'GET /api/panier': () => ({
          data: {
            lignes: [
              {
                articleId: 101,
                nom: 'Brik',
                prixUnitaire: 25,
                imageUrl: null,
                disponible: true,
                quantite: 1,
                totalLigne: 25,
                avertissement: null,
              },
            ],
            nombreArticles: 1,
            sousTotal: 25,
            dateMiseAJour: null,
          },
        }),
        'GET /api/adresses': () => ({ status: 500, data: { title: 'Erreur' } }),
      }),
    )
    renderApp('/commande')
    await userEvent.click(await screen.findByLabelText(/Livraison/))

    const field = await screen.findByLabelText(/Adresse de livraison/)
    fireEvent.change(field, { target: { value: '12 rue de la Liberté, Tunis' } })
    expect(field).toHaveValue('12 rue de la Liberté, Tunis')
  })
})
