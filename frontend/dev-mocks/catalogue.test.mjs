import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd(), '..') + '/'
const { categories } = JSON.parse(readFileSync(`${root}docs/catalogue.json`, 'utf8'))
const articles = categories.flatMap((c) => c.articles)
const seq = (n) => Array.from({ length: n }, (_, i) => i + 1)

describe('docs/catalogue.json', () => {
  it('contient 5 catégories à ordre croissant et unique (Boissons = 9), avec noms FR et AR', () => {
    expect(categories.map((c) => c.nomFr)).toEqual([
      'Entrées et salades',
      'Burgers et sandwichs',
      'Pizzas et pâtes',
      'Desserts',
      'Boissons',
    ])
    expect(categories.map((c) => c.ordre)).toEqual([1, 2, 3, 4, 9])
    for (const c of categories) expect(c.nomAr?.trim(), c.nomFr).toBeTruthy()
  })

  it('a 5 articles par catégorie, ordonnés de 1 à 5, soit 25 au total', () => {
    for (const c of categories)
      expect(
        c.articles.map((a) => a.ordre),
        c.nomFr,
      ).toEqual(seq(5))
    expect(articles).toHaveLength(25)
  })

  it('a des noms uniques, des prix >= 0 et des textes FR/AR non vides', () => {
    for (const key of ['nomFr', 'nomAr']) {
      expect(new Set(articles.map((a) => a[key])).size).toBe(articles.length)
    }
    for (const a of articles) {
      expect(typeof a.prix, a.nomFr).toBe('number')
      expect(a.prix, a.nomFr).toBeGreaterThanOrEqual(0)
      expect(typeof a.populaire, a.nomFr).toBe('boolean')
      expect(typeof a.disponible, a.nomFr).toBe('boolean')
      for (const key of ['nomFr', 'nomAr', 'descriptionFr', 'descriptionAr']) {
        expect(a[key]?.trim(), `${a.nomFr}.${key}`).toBeTruthy()
      }
      expect(a.descriptionFr.length, a.nomFr).toBeLessThanOrEqual(110)
      expect(a.nomAr, a.nomFr).toMatch(/[؀-ۿ]/)
      expect(a.descriptionAr, a.nomFr).toMatch(/[؀-ۿ]/)
    }
  })

  it('a des noms uniques par catégorie', () => {
    for (const c of categories)
      expect(new Set(c.articles.map((a) => a.nomFr)).size, c.nomFr).toBe(c.articles.length)
  })

  it('marque seules les lasagnes indisponibles', () => {
    expect(articles.filter((a) => !a.disponible).map((a) => a.nomFr)).toEqual(['Lasagnes'])
  })

  it('référence des images existantes de moins de 150 Ko (images non nulles seulement)', () => {
    for (const a of articles.filter((x) => x.image !== null)) {
      expect(a.image, a.nomFr).toMatch(/^\/images\/menu\/[a-z0-9-]+\.webp$/)
      const file = `${root}frontend/public${a.image}`
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size, file).toBeLessThan(150 * 1024)
    }
  })
})
