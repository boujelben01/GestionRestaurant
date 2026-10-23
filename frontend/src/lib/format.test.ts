import { describe, expect, it } from 'vitest'
import { formatPrice, formatTime, todayInTunis, weekdayName } from './format'

// Intl met un espace insécable (U+00A0 / U+202F) entre le montant et le symbole.
const normalize = (s: string) => s.replace(/[\s\u00a0\u202f\u200f]/g, ' ').trim()

describe('formatPrice', () => {
  it('affiche deux décimales et la devise en français', () => {
    const out = normalize(formatPrice(12.5, 'fr'))
    expect(out).toContain('12,50')
    expect(out).toMatch(/DT|TND/)
  })

  it('arrondit à deux décimales', () => {
    expect(normalize(formatPrice(3.456, 'fr'))).toContain('3,46')
  })

  it('formate en arabe avec une devise arabe ou le code', () => {
    const out = formatPrice(14, 'ar')
    expect(out).toMatch(/14/)
    expect(out).toMatch(/\.|,|٫/) // séparateur décimal présent (deux décimales)
  })

  it('formate zéro', () => {
    expect(normalize(formatPrice(0, 'fr'))).toContain('0,00')
  })
})

describe('jours et heures', () => {
  it('0 = dimanche, 6 = samedi', () => {
    expect(weekdayName(0, 'fr').toLowerCase()).toBe('dimanche')
    expect(weekdayName(6, 'fr').toLowerCase()).toBe('samedi')
    expect(weekdayName(1, 'fr').toLowerCase()).toBe('lundi')
  })

  it('jour courant dans le fuseau Africa/Tunis', () => {
    // 2024-06-02 est un dimanche ; 23:30 UTC le samedi = 00:30 dimanche à Tunis (UTC+1).
    expect(todayInTunis(new Date('2024-06-01T23:30:00Z'))).toBe(0)
    expect(todayInTunis(new Date('2024-06-01T12:00:00Z'))).toBe(6)
  })

  it('formate les heures HH:mm', () => {
    expect(formatTime('11:00', 'fr')).toContain('11')
    expect(formatTime('02:30', 'fr')).toContain('30')
  })
})
