import { describe, expect, it } from 'vitest'
import { VARIATION_ARROW, formatVariation, variationDirection, variationTone } from './variation'

const norm = (s: string) => s.replace(/[\s\u00a0\u202f\u200f\u200e]/g, '')

describe('variation : direction', () => {
  it('hausse, baisse, stable, indéfinie', () => {
    expect(variationDirection(12.5)).toBe('up')
    expect(variationDirection(-3)).toBe('down')
    expect(variationDirection(0)).toBe('flat')
    expect(variationDirection(0.04)).toBe('flat')
    expect(variationDirection(null)).toBe('none')
    expect(variationDirection(undefined)).toBe('none')
    expect(variationDirection(Number.NaN)).toBe('none')
  })

  it("chaque direction a sa flèche (la couleur ne porte jamais seule l'information)", () => {
    expect(VARIATION_ARROW).toEqual({ up: '↑', down: '↓', flat: '→', none: '–' })
  })
})

describe('variation : tonalité', () => {
  it("une hausse du chiffre d'affaires est bonne, une baisse mauvaise", () => {
    expect(variationTone(10)).toBe('good')
    expect(variationTone(-10)).toBe('bad')
  })

  it("pour les annulations ou le montant à encaisser, c'est l'inverse", () => {
    expect(variationTone(10, false)).toBe('bad')
    expect(variationTone(-10, false)).toBe('good')
  })

  it('stable ou indéfinie : neutre', () => {
    expect(variationTone(0)).toBe('neutral')
    expect(variationTone(null)).toBe('neutral')
    expect(variationTone(null, false)).toBe('neutral')
  })
})

describe('variation : formatage', () => {
  it('affiche le signe et une décimale en français', () => {
    expect(norm(formatVariation(12.5, 'fr'))).toBe('+12,5%')
    expect(norm(formatVariation(-3, 'fr'))).toMatch(/^[-−–]3,0%$/)
    expect(norm(formatVariation(0, 'fr'))).toBe('0,0%')
  })

  it('formate aussi en arabe, avec un pourcentage et une décimale', () => {
    const out = norm(formatVariation(12.5, 'ar'))
    expect(out).toContain('12')
    expect(out).toContain('%')
  })

  it("une valeur indéfinie s'affiche « — », pas « 0 % »", () => {
    expect(formatVariation(null, 'fr')).toBe('—')
    expect(formatVariation(undefined, 'ar')).toBe('—')
  })
})
