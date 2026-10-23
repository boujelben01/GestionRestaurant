import { describe, expect, it } from 'vitest'
import type { MenuArticle, MenuCategorie } from '@/lib/types'
import { filterCategories, normalizeText } from './filter'

const art = (id: number, nom: string, extra: Partial<MenuArticle> = {}): MenuArticle => ({
  id,
  categorieId: 1,
  nom,
  description: null,
  prix: 5,
  imageUrl: null,
  estPopulaire: false,
  disponible: true,
  ...extra,
})

const categories: MenuCategorie[] = [
  {
    id: 1,
    nom: 'Entrées',
    ordre: 1,
    articles: [art(1, "Brik à l'œuf", { estPopulaire: true }), art(2, 'Lablabi')],
  },
  { id: 2, nom: 'Desserts', ordre: 2, articles: [art(3, 'Brownie glacé', { disponible: false })] },
  { id: 3, nom: 'Boissons', ordre: 3, articles: [art(4, 'شاي بالنعناع')] },
]

describe('normalizeText', () => {
  it('ignore accents et casse', () => {
    expect(normalizeText('  Entrée  ')).toBe('entree')
  })
  it('unifie les variantes arabes', () => {
    expect(normalizeText('أحمد')).toBe(normalizeText('احمد'))
  })
})

describe('filterCategories', () => {
  it('sans filtre renvoie tout', () => {
    expect(filterCategories(categories, { query: '', popularOnly: false })).toBe(categories)
  })

  it('cherche sans accent ni casse et retire les catégories vides', () => {
    const out = filterCategories(categories, { query: 'ENTREE brik', popularOnly: false })
    expect(out).toHaveLength(0) // « entree » est le nom de catégorie, pas de l'article
    const out2 = filterCategories(categories, { query: 'brik', popularOnly: false })
    expect(out2.map((c) => c.id)).toEqual([1])
    expect(out2[0]?.articles.map((a) => a.id)).toEqual([1])
  })

  it('garde les articles indisponibles dans les résultats', () => {
    const out = filterCategories(categories, { query: 'brownie', popularOnly: false })
    expect(out[0]?.articles[0]?.disponible).toBe(false)
  })

  it('filtre les populaires', () => {
    const out = filterCategories(categories, { query: '', popularOnly: true })
    expect(out.flatMap((c) => c.articles.map((a) => a.id))).toEqual([1])
  })

  it('combine recherche et populaires', () => {
    expect(filterCategories(categories, { query: 'lablabi', popularOnly: true })).toEqual([])
  })

  it('cherche en arabe', () => {
    const out = filterCategories(categories, { query: 'نعناع', popularOnly: false })
    expect(out.map((c) => c.id)).toEqual([3])
  })
})
