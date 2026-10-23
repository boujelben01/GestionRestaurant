/**
 * Validation des formulaires catégorie / article, alignée sur CategorieRequest, ArticleRequest et
 * ImageUrlRules du back-end. Les fonctions retournent des CODES d'erreur (traduits par l'UI).
 */

export const NAME_MAX = 150
export const CATEGORY_NAME_MAX = 100
export const DESCRIPTION_MAX = 1000
export const IMAGE_URL_MAX = 500
export const PRICE_MAX = 99_999_999.99

export type MenuErrorCode =
  | 'required'
  | 'tooLong'
  | 'priceInvalid'
  | 'priceNegative'
  | 'priceTooHigh'
  | 'priceDecimals'
  | 'imageUrl'
  | 'category'

// --- Image ---

const LOCAL_PATH = /^\/images\/[A-Za-z0-9._\-/]+$/

/** Même règle que ImageUrlRules.IsValid : « /images/<nom> » ou URL https absolue sans identifiants. */
export function isValidImageUrl(value: string): boolean {
  if (!value || value.length > IMAGE_URL_MAX) return false
  if (value.startsWith('/images/')) {
    return (
      LOCAL_PATH.test(value) &&
      !value.endsWith('/') &&
      !value.includes('//') &&
      !value.split('/').includes('..')
    )
  }
  try {
    const url = new URL(value)
    return (
      url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === ''
    )
  } catch {
    return false
  }
}

// --- Prix ---

/** « 4,5 » et « 4.50 » sont acceptés (clavier tunisien) ; null si le texte n'est pas un nombre. */
export function parsePrice(text: string): number | null {
  const normalized = text.trim().replace(/\s/g, '').replace(',', '.')
  if (!/^\d+(\.\d+)?$/.test(normalized)) return null
  return Number(normalized)
}

export function priceError(text: string): MenuErrorCode | undefined {
  if (!text.trim()) return 'required'
  if (text.trim().startsWith('-')) return 'priceNegative'
  const price = parsePrice(text)
  if (price === null) return 'priceInvalid'
  if (price > PRICE_MAX) return 'priceTooHigh'
  if (Math.round(price * 100) / 100 !== price) return 'priceDecimals'
  return undefined
}

// --- Article ---

export interface ArticleFormValues {
  categorieId: number | null
  nomFr: string
  nomAr: string
  descriptionFr: string
  descriptionAr: string
  prix: string
  imageUrl: string
  estPopulaire: boolean
  estDisponible: boolean
}

export const EMPTY_ARTICLE: ArticleFormValues = {
  categorieId: null,
  nomFr: '',
  nomAr: '',
  descriptionFr: '',
  descriptionAr: '',
  prix: '',
  imageUrl: '',
  estPopulaire: false,
  estDisponible: true,
}

export type ArticleField =
  'categorieId' | 'nomFr' | 'nomAr' | 'descriptionFr' | 'descriptionAr' | 'prix' | 'imageUrl'

export function validateArticle(
  values: ArticleFormValues,
): Partial<Record<ArticleField, MenuErrorCode>> {
  const errors: Partial<Record<ArticleField, MenuErrorCode>> = {}
  if (values.categorieId === null) errors.categorieId = 'category'
  if (!values.nomFr.trim()) errors.nomFr = 'required'
  else if (values.nomFr.trim().length > NAME_MAX) errors.nomFr = 'tooLong'
  if (!values.nomAr.trim()) errors.nomAr = 'required'
  else if (values.nomAr.trim().length > NAME_MAX) errors.nomAr = 'tooLong'
  if (values.descriptionFr.length > DESCRIPTION_MAX) errors.descriptionFr = 'tooLong'
  if (values.descriptionAr.length > DESCRIPTION_MAX) errors.descriptionAr = 'tooLong'
  const price = priceError(values.prix)
  if (price) errors.prix = price
  if (values.imageUrl.trim() && !isValidImageUrl(values.imageUrl.trim()))
    errors.imageUrl = 'imageUrl'
  return errors
}

/** Corps de POST / PUT /api/admin/articles : champs facultatifs vides = null. */
export function buildArticleRequest(values: ArticleFormValues) {
  return {
    categorieId: values.categorieId as number,
    nomFr: values.nomFr.trim(),
    nomAr: values.nomAr.trim(),
    prix: parsePrice(values.prix) as number,
    descriptionFr: values.descriptionFr.trim() || null,
    descriptionAr: values.descriptionAr.trim() || null,
    imageUrl: values.imageUrl.trim() || null,
    estDisponible: values.estDisponible,
    estPopulaire: values.estPopulaire,
  }
}

// --- Catégorie ---

export interface CategoryFormValues {
  nomFr: string
  nomAr: string
}

export function validateCategory(
  values: CategoryFormValues,
): Partial<Record<'nomFr' | 'nomAr', MenuErrorCode>> {
  const errors: Partial<Record<'nomFr' | 'nomAr', MenuErrorCode>> = {}
  for (const field of ['nomFr', 'nomAr'] as const) {
    const value = values[field].trim()
    if (!value) errors[field] = 'required'
    else if (value.length > CATEGORY_NAME_MAX) errors[field] = 'tooLong'
  }
  return errors
}

// --- Réordonnancement (boutons monter / descendre) ---

/** Déplace l'élément à `index` de `delta` rangs ; renvoie la même liste si le déplacement est impossible. */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items]
  const copy = [...items]
  const [moved] = copy.splice(index, 1)
  copy.splice(target, 0, moved as T)
  return copy
}
