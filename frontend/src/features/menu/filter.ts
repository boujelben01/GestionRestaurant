import type { MenuArticle, MenuCategorie } from '@/lib/types'

/**
 * Normalise un texte pour la recherche : minuscules, sans accents latins ni voyelles brèves
 * arabes (tashkeel, tatweel), variantes de l'alef unifiées, espaces compactés.
 */
export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ًͯ-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/œ/gi, 'oe')
    .replace(/æ/gi, 'ae')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export interface MenuFilters {
  query: string
  popularOnly: boolean
}

export function articleMatches(article: MenuArticle, tokens: string[], popularOnly: boolean) {
  if (popularOnly && !article.estPopulaire) return false
  if (tokens.length === 0) return true
  const haystack = normalizeText(`${article.nom} ${article.description ?? ''}`)
  return tokens.every((token) => haystack.includes(token))
}

/**
 * Filtre les catégories : chaque mot de la recherche doit apparaître dans le nom ou la
 * description. Les catégories qui n'ont plus d'article sont retirées ; l'ordre est conservé.
 * Sans filtre actif, le tableau d'origine est renvoyé tel quel.
 */
export function filterCategories(
  categories: MenuCategorie[],
  { query, popularOnly }: MenuFilters,
): MenuCategorie[] {
  const tokens = normalizeText(query).split(' ').filter(Boolean)
  if (tokens.length === 0 && !popularOnly) return categories
  return categories
    .map((category) => ({
      ...category,
      articles: category.articles.filter((a) => articleMatches(a, tokens, popularOnly)),
    }))
    .filter((category) => category.articles.length > 0)
}

export function countArticles(categories: MenuCategorie[]): number {
  return categories.reduce((total, category) => total + category.articles.length, 0)
}
