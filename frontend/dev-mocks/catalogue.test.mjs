import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Source unique du catalogue, lue par le back-end (--seed-catalog) et par le faux serveur.
const root = resolve(process.cwd(), '..') + '/'
const { categories } = JSON.parse(
  readFileSync(`${root}backend/src/Resto.Api/Data/catalogue.json`, 'utf8'),
)
const articles = categories.flatMap((c) => c.articles)
const seq = (n) => Array.from({ length: n }, (_, i) => i + 1)
const unique = (values) => new Set(values).size === values.length

describe('backend/src/Resto.Api/Data/catalogue.json', () => {
  it('contient au moins une catégorie, avec noms FR et AR et un ordre unique', () => {
    expect(categories.length).toBeGreaterThan(0)
    for (const c of categories) {
      expect(c.nomFr?.trim(), 'nomFr').toBeTruthy()
      expect(c.nomAr?.trim(), c.nomFr).toBeTruthy()
      expect(c.nomAr, c.nomFr).toMatch(/[؀-ۿ]/)
      expect(Number.isInteger(c.ordre) && c.ordre >= 0, c.nomFr).toBe(true)
    }
    expect(unique(categories.map((c) => c.nomFr.toLowerCase()))).toBe(true)
    expect(unique(categories.map((c) => c.ordre))).toBe(true)
  })

  it('a des articles ordonnés de façon consécutive à partir de 1 dans chaque catégorie (une catégorie vide est valide)', () => {
    for (const c of categories) {
      expect(Array.isArray(c.articles), c.nomFr).toBe(true)
      expect(
        c.articles.map((a) => a.ordre),
        c.nomFr,
      ).toEqual(seq(c.articles.length))
    }
  })

  it('contient au moins un article au total', () => {
    expect(articles.length).toBeGreaterThan(0)
  })

  it('a des noms uniques par catégorie, des prix >= 0 à 2 décimales et des textes FR/AR non vides', () => {
    for (const c of categories) {
      expect(unique(c.articles.map((a) => a.nomFr.toLowerCase())), c.nomFr).toBe(true)
    }
    for (const a of articles) {
      expect(typeof a.prix, a.nomFr).toBe('number')
      expect(a.prix, a.nomFr).toBeGreaterThanOrEqual(0)
      expect(Math.round(a.prix * 100) / 100, a.nomFr).toBe(a.prix)
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

  it('référence des images existantes de moins de 150 Ko (images non nulles seulement)', () => {
    for (const a of articles.filter((x) => x.image !== null)) {
      expect(a.image, a.nomFr).toMatch(/^\/images\/menu\/[a-z0-9-]+\.webp$/)
      const file = `${root}frontend/public${a.image}`
      expect(existsSync(file), file).toBe(true)
      expect(statSync(file).size, file).toBeLessThan(150 * 1024)
    }
  })
})
