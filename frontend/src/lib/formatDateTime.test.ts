import { describe, expect, it } from 'vitest'
import { formatDateTime } from './format'

describe('formatDateTime', () => {
  it('convertit un instant UTC dans le fuseau de Tunis', () => {
    // 2026-01-15T10:30:00Z = 11:30 à Tunis (UTC+1, pas d'heure d'été).
    expect(formatDateTime('2026-01-15T10:30:00Z', 'fr')).toMatch(/11:30/)
  })

  it('renvoie une chaîne vide pour une date invalide', () => {
    expect(formatDateTime('pas-une-date', 'fr')).toBe('')
  })
})
