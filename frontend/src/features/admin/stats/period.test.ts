import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PERIOD,
  addDays,
  daysIn,
  detectPreset,
  isValidDate,
  periodToParams,
  presetPeriod,
  resolvePeriod,
  tunisToday,
  validateCustom,
} from './period'

const TODAY = '2024-06-15'
const params = (query: string) => new URLSearchParams(query)

describe('jour civil de Tunis', () => {
  it('à 23h30 UTC, Tunis est déjà le lendemain', () => {
    expect(tunisToday(new Date('2024-06-14T23:30:00Z'))).toBe('2024-06-15')
    expect(tunisToday(new Date('2024-06-14T22:59:00Z'))).toBe('2024-06-14')
  })
})

describe('dates', () => {
  it.each(['2024-06-15', '2024-02-29', '2023-12-31'])('%s est valide', (d) =>
    expect(isValidDate(d)).toBe(true),
  )

  it.each([
    '2024-02-30',
    '2023-02-29',
    '2024-13-01',
    '2024-6-1',
    '15/06/2024',
    '2024-06-15T10:00',
    '',
    'abc',
  ])('%j est refusée', (d) => expect(isValidDate(d)).toBe(false))

  it('calcule jours et durées bornes incluses, à cheval sur les mois et années bissextiles', () => {
    expect(addDays('2024-03-01', -1)).toBe('2024-02-29')
    expect(addDays('2024-12-31', 1)).toBe('2025-01-01')
    expect(daysIn({ du: '2024-06-15', au: '2024-06-15' })).toBe(1)
    expect(daysIn({ du: '2024-06-01', au: '2024-06-30' })).toBe(30)
    expect(daysIn({ du: '2023-06-15', au: '2024-06-14' })).toBe(366)
  })
})

describe('périodes prédéfinies', () => {
  it("7, 30 et 90 jours se terminent aujourd'hui, aujourd'hui compris", () => {
    expect(presetPeriod(7, TODAY)).toEqual({ du: '2024-06-09', au: TODAY })
    expect(daysIn(presetPeriod(30, TODAY))).toBe(30)
    expect(daysIn(presetPeriod(90, TODAY))).toBe(90)
  })

  it('la période par défaut est les 30 derniers jours', () => {
    expect(DEFAULT_PERIOD(TODAY)).toEqual({ du: '2024-05-17', au: TODAY })
  })

  it('reconnaît le préréglage actif, sinon « custom »', () => {
    expect(detectPreset(presetPeriod(7, TODAY), TODAY)).toBe('7')
    expect(detectPreset(presetPeriod(30, TODAY), TODAY)).toBe('30')
    expect(detectPreset(presetPeriod(90, TODAY), TODAY)).toBe('90')
    expect(detectPreset({ du: '2024-06-01', au: '2024-06-10' }, TODAY)).toBe('custom')
    expect(detectPreset({ du: '2024-06-02', au: TODAY }, TODAY)).toBe('custom') // 14 jours
    expect(detectPreset({ du: addDays(TODAY, -6), au: addDays(TODAY, -1) }, TODAY)).toBe('custom') // ne finit pas aujourd'hui
  })
})

describe("période lue dans l'URL", () => {
  it("sans paramètre : 30 derniers jours, pas d'erreur", () => {
    expect(resolvePeriod(params(''), TODAY)).toEqual({
      period: { du: '2024-05-17', au: TODAY },
      invalid: false,
    })
  })

  it('du et au valides sont repris tels quels', () => {
    expect(resolvePeriod(params('du=2024-06-01&au=2024-06-10'), TODAY)).toEqual({
      period: { du: '2024-06-01', au: '2024-06-10' },
      invalid: false,
    })
  })

  it("seul du : jusqu'à aujourd'hui ; seul au : les 30 jours précédents", () => {
    expect(resolvePeriod(params('du=2024-06-01'), TODAY).period).toEqual({
      du: '2024-06-01',
      au: TODAY,
    })
    expect(resolvePeriod(params('au=2024-03-31'), TODAY).period).toEqual({
      du: '2024-03-02',
      au: '2024-03-31',
    })
  })

  it.each([
    'du=pas-une-date',
    'au=2024-02-30',
    'du=2024-06-10&au=2024-06-01',
    'du=2020-01-01&au=2022-01-01',
    'du=2023-06-14&au=2024-06-14', // 367 jours
  ])('%s : retour à la période par défaut et signalement', (query) => {
    const resolved = resolvePeriod(params(query), TODAY)
    expect(resolved.invalid).toBe(true)
    expect(resolved.period).toEqual(DEFAULT_PERIOD(TODAY))
  })

  it('366 jours exactement est accepté', () => {
    expect(resolvePeriod(params('du=2023-06-15&au=2024-06-14'), TODAY).invalid).toBe(false)
  })

  it("une période écrite dans l'URL est relue à l'identique (aller-retour)", () => {
    const period = { du: '2024-04-01', au: '2024-04-30' }
    expect(resolvePeriod(periodToParams(period), TODAY).period).toEqual(period)
  })
})

describe("saisie d'une période personnalisée", () => {
  it('valide, inversée, invalide ou trop longue', () => {
    expect(validateCustom('2024-06-01', '2024-06-10')).toBeUndefined()
    expect(validateCustom('2024-06-10', '2024-06-01')).toBe('order')
    expect(validateCustom('', '2024-06-01')).toBe('invalid')
    expect(validateCustom('2024-06-01', '2024-02-30')).toBe('invalid')
    expect(validateCustom('2023-01-01', '2024-06-01')).toBe('tooLong')
    expect(validateCustom('2023-06-15', '2024-06-14')).toBeUndefined()
  })
})
