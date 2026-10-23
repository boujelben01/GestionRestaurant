import { QueryClient } from '@tanstack/react-query'
import { afterEach, describe, expect, it } from 'vitest'
import type { Commande, MenuCategorie, Panier } from '@/lib/types'
import { mockApi } from '@/test/mockApi'
import { reorder } from './reorder'

const article = (id: number, nom: string, disponible = true) => ({
  id,
  categorieId: 1,
  nom,
  description: null,
  prix: 5,
  imageUrl: null,
  estPopulaire: false,
  disponible,
})

const menu: MenuCategorie[] = [
  {
    id: 1,
    nom: 'Plats',
    ordre: 1,
    articles: [article(1, 'Brik'), article(2, 'Lablabi', false), article(4, 'Makloub')],
  },
]

const ligne = (articleId: number | null, nomFr: string, quantite: number) => ({
  articleId,
  nomFr,
  nomAr: `${nomFr}-ar`,
  prixUnitaire: 1,
  quantite,
  totalLigne: quantite,
})

const order = {
  id: 1,
  lignes: [
    ligne(1, 'Brik', 2),
    ligne(2, 'Lablabi', 1), // indisponible
    ligne(3, 'Ancien plat', 1), // retiré du menu
    ligne(null, 'Article supprimé', 1), // ArticleId nul
    ligne(4, 'Makloub', 25), // plafonné à 20
  ],
} as unknown as Commande

const cart: Panier = { lignes: [], nombreArticles: 0, sousTotal: 0, dateMiseAJour: null }

let mock: ReturnType<typeof mockApi> | undefined
afterEach(() => mock?.restore())

describe('reorder (« Commander à nouveau »)', () => {
  it("ajoute les articles disponibles et résume ce qui n'a pas pu l'être", async () => {
    mock = mockApi({
      'GET /api/menu': () => ({ data: menu }),
      'POST /api/panier/items': () => ({ data: cart }),
    })
    const result = await reorder(new QueryClient(), order, 'fr')

    expect(result.added.map((a) => a.nom)).toEqual(['Brik', 'Makloub'])
    expect(result.skipped).toEqual([
      { nom: 'Lablabi', reason: 'unavailable' },
      { nom: 'Ancien plat', reason: 'removed' },
      { nom: 'Article supprimé', reason: 'noArticle' },
    ])
    const posts = mock.calls
      .filter((c) => c.method === 'post')
      .map((c) => JSON.parse(String(c.data)))
    expect(posts).toEqual([
      { articleId: 1, quantite: 2 },
      { articleId: 4, quantite: 20 },
    ])
  })

  it('continue après une erreur serveur sur une ligne', async () => {
    let n = 0
    mock = mockApi({
      'GET /api/menu': () => ({ data: menu }),
      'POST /api/panier/items': () =>
        ++n === 1 ? { status: 409, data: { title: 'indispo' } } : { data: cart },
    })
    const result = await reorder(new QueryClient(), order, 'fr')
    expect(result.skipped[0]).toEqual({ nom: 'Brik', reason: 'error' })
    expect(result.added.map((a) => a.nom)).toEqual(['Makloub'])
  })
})
