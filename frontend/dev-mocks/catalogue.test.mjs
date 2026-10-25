import { existsSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd(), '..') + '/'
const catalogue = JSON.parse(readFileSync(`${root}docs/catalogue.json`, 'utf8'))
const { categorie, articles } = catalogue

describe('docs/catalogue.json', () => {
  it('décrit la catégorie « Desserts et boissons » en position 6', () => {
    expect(categorie).toEqual({
      nomFr: 'Desserts et boissons',
      nomAr: 'الحلويات والمشروبات',
      ordre: 6,
    })
  })

  it('contient 16 articles ordonnés de 1 à 16', () => {
    expect(articles.map((a) => a.ordre)).toEqual(Array.from({ length: 16 }, (_, i) => i + 1))
  })

  it('a des noms uniques, des prix >= 0 et des textes non vides', () => {
    for (const key of ['nomFr', 'nomAr']) {
      expect(new Set(articles.map((a) => a[key])).size).toBe(articles.length)
    }
    for (const a of articles) {
      expect(typeof a.prix).toBe('number')
      expect(a.prix).toBeGreaterThanOrEqual(0)
      for (const key of ['nomFr', 'nomAr', 'descriptionFr', 'descriptionAr']) {
        expect(a[key]?.trim(), `${a.nomFr}.${key}`).toBeTruthy()
      }
      expect(a.descriptionFr.length, a.nomFr).toBeLessThanOrEqual(110)
      expect(a.descriptionAr).toMatch(/[؀-ۿ]/)
    }
  })

  it('marque seul le tiramisu indisponible', () => {
    expect(articles.filter((a) => !a.disponible).map((a) => a.nomFr)).toEqual(['Tiramisu'])
  })

  it('référence des images existantes de moins de 150 Ko (images non nulles seulement)', () => {
    for (const a of articles.filter((x) => x.image !== null)) {
      expect(a.image, a.nomFr).toMatch(/^\/images\/[a-z0-9/-]+\.(webp|jpg|png)$/)
      const file = `${root}frontend/public${a.image}`
      expect(existsSync(file), file).toBe(true)
      if (a.image.endsWith('.webp')) {
        expect(statSync(file).size, file).toBeLessThan(150 * 1024)
      }
    }
  })
})
