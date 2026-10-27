import { describe, expect, it } from 'vitest'
import {
  EMPTY_ARTICLE,
  buildArticleRequest,
  isValidImageUrl,
  moveItem,
  parsePrice,
  priceError,
  validateArticle,
  validateCategory,
  type ArticleFormValues,
} from './validation'

const valid: ArticleFormValues = {
  ...EMPTY_ARTICLE,
  categorieId: 1,
  nomFr: 'Brik',
  prix: '4,50',
}

describe('isValidImageUrl (ImageUrlRules du back-end)', () => {
  it.each([
    '/images/brik.jpg',
    '/images/sous-dossier/brik_1.webp',
    '/images/default.svg',
    'https://cdn.example.com/brik.jpg',
  ])('accepte %s', (url) => expect(isValidImageUrl(url)).toBe(true))

  it.each([
    '',
    'images/brik.jpg',
    '/img/brik.jpg',
    '/images/',
    '/images//brik.jpg',
    '/images/../secret.png',
    '/images/brik jpg',
    '/images/brik?x=1',
    'http://cdn.example.com/brik.jpg',
    'https://user:pass@cdn.example.com/brik.jpg',
    'javascript:alert(1)',
    'ftp://example.com/a.jpg',
    '/images/' + 'a'.repeat(500),
  ])('refuse %j', (url) => expect(isValidImageUrl(url)).toBe(false))
})

describe('prix', () => {
  it('accepte la virgule et le point décimal', () => {
    expect(parsePrice('4,5')).toBe(4.5)
    expect(parsePrice('4.50')).toBe(4.5)
    expect(parsePrice(' 12 ')).toBe(12)
    expect(parsePrice('abc')).toBeNull()
    expect(parsePrice('1,2,3')).toBeNull()
  })

  it.each([
    ['', 'required'],
    ['abc', 'priceInvalid'],
    ['-1', 'priceNegative'],
    ['4,555', 'priceDecimals'],
    ['100000000', 'priceTooHigh'],
  ])('%j → %s', (text, code) => expect(priceError(text)).toBe(code))

  it.each(['0', '4', '4,5', '4.50', '99999999.99'])('%j est valide', (text) =>
    expect(priceError(text)).toBeUndefined(),
  )
})

describe('formulaire article', () => {
  it('un article complet est valide', () => {
    expect(validateArticle(valid)).toEqual({})
  })

  it('exige catégorie, nom et prix', () => {
    const errors = validateArticle(EMPTY_ARTICLE)
    expect(errors).toMatchObject({
      categorieId: 'category',
      nomFr: 'required',
      prix: 'required',
    })
  })

  it('limite les noms (150) et les descriptions (1000)', () => {
    const errors = validateArticle({
      ...valid,
      nomFr: 'x'.repeat(151),
      descriptionFr: 'y'.repeat(1001),
    })
    expect(errors.nomFr).toBe('tooLong')
    expect(errors.descriptionFr).toBe('tooLong')
    expect(validateArticle({ ...valid, nomFr: 'x'.repeat(150) }).nomFr).toBeUndefined()
  })

  it("l'image est facultative mais doit être valide si renseignée", () => {
    expect(validateArticle({ ...valid, imageUrl: '' }).imageUrl).toBeUndefined()
    expect(validateArticle({ ...valid, imageUrl: '/images/brik.jpg' }).imageUrl).toBeUndefined()
    expect(validateArticle({ ...valid, imageUrl: 'http://x.com/a.jpg' }).imageUrl).toBe('imageUrl')
  })

  it('construit le corps de requête : prix numérique, champs vides à null', () => {
    expect(buildArticleRequest({ ...valid, nomFr: '  Brik  ', imageUrl: '' })).toEqual({
      categorieId: 1,
      nomFr: 'Brik',
      prix: 4.5,
      descriptionFr: null,
      imageUrl: null,
      estDisponible: true,
      estPopulaire: false,
    })
  })
})

describe('formulaire catégorie', () => {
  it('exige le nom, 100 caractères au plus', () => {
    expect(validateCategory({ nomFr: ' ' })).toEqual({
      nomFr: 'required',
    })
    expect(validateCategory({ nomFr: 'x'.repeat(101) })).toEqual({ nomFr: 'tooLong' })
    expect(validateCategory({ nomFr: 'Entrées' })).toEqual({})
  })
})

describe('moveItem (monter / descendre au clavier)', () => {
  it("déplace sans modifier la liste d'origine", () => {
    const list = ['a', 'b', 'c']
    expect(moveItem(list, 1, -1)).toEqual(['b', 'a', 'c'])
    expect(moveItem(list, 1, 1)).toEqual(['a', 'c', 'b'])
    expect(list).toEqual(['a', 'b', 'c'])
  })

  it('ne bouge pas aux extrémités', () => {
    expect(moveItem(['a', 'b'], 0, -1)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b'])
  })
})
