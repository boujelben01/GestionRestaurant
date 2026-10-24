import { describe, expect, it } from 'vitest'
import type { PeakHour, SalesDay, StatsResume } from '@/lib/types'
import {
  bestDay,
  busiestHour,
  donutSlices,
  isEmptyPeriod,
  niceMax,
  share,
  sum,
  ticks,
} from './chartMath'

describe('axes', () => {
  it.each([
    [0, 1],
    [-5, 1],
    [0.7, 1],
    [1, 1],
    [1.2, 2],
    [2.4, 2.5],
    [3, 5],
    [7, 10],
    [87, 100],
    [230, 250],
    [1234, 2000],
    [4999.99, 5000],
  ])('niceMax(%s) = %s', (value, expected) => expect(niceMax(value)).toBe(expected))

  it('niceMax gère les valeurs non finies', () => {
    expect(niceMax(Number.NaN)).toBe(1)
    expect(niceMax(Number.POSITIVE_INFINITY)).toBe(1)
  })

  it('les graduations vont de 0 à la borne haute, régulièrement', () => {
    expect(ticks(87)).toEqual([0, 25, 50, 75, 100])
    expect(ticks(0)).toEqual([0, 0.25, 0.5, 0.75, 1])
    expect(ticks(230, 5)).toHaveLength(6)
  })
})

describe('parts', () => {
  it('somme et pourcentage, sans diviser par zéro', () => {
    expect(sum([1, 2, 3.5])).toBe(6.5)
    expect(share(25, 100)).toBe(25)
    expect(share(5, 0)).toBe(0)
  })

  it('le donut ignore les parts nulles et calcule les pourcentages', () => {
    const slices = donutSlices([
      { type: 'SurPlace', commandes: 30 },
      { type: 'Livraison', commandes: 10 },
      { type: 'ARemporter', commandes: 0 },
    ])
    expect(slices.map((s) => s.type)).toEqual(['SurPlace', 'Livraison'])
    expect(slices.map((s) => s.percent)).toEqual([75, 25])
    expect(donutSlices([{ commandes: 0 }])).toEqual([])
  })
})

describe('repères', () => {
  const hours = (counts: Record<number, number>): PeakHour[] =>
    Array.from({ length: 24 }, (_, heure) => ({
      heure,
      commandes: counts[heure] ?? 0,
      chiffreAffaires: 0,
    }))

  it("l'heure de pointe est celle qui a le plus de commandes (la plus tôt en cas d'égalité)", () => {
    expect(busiestHour(hours({ 12: 9, 20: 14, 21: 14 }))?.heure).toBe(20)
    expect(busiestHour(hours({}))).toBeNull()
  })

  it("le meilleur jour est celui qui a le plus fort chiffre d'affaires", () => {
    const days: SalesDay[] = [
      { date: '2024-06-01', chiffreAffaires: 100, commandes: 5 },
      { date: '2024-06-02', chiffreAffaires: 340, commandes: 12 },
      { date: '2024-06-03', chiffreAffaires: 0, commandes: 0 },
    ]
    expect(bestDay(days)?.date).toBe('2024-06-02')
    expect(bestDay([{ date: '2024-06-03', chiffreAffaires: 0, commandes: 0 }])).toBeNull()
  })

  it('une période sans commande ni annulation est « vide » ; des annulations seules ne le sont pas', () => {
    const resume = (nombreCommandes: number, nombreAnnulees: number) =>
      ({ periode: { nombreCommandes, nombreAnnulees } }) as Pick<StatsResume, 'periode'>
    expect(isEmptyPeriod(resume(0, 0))).toBe(true)
    expect(isEmptyPeriod(resume(3, 0))).toBe(false)
    expect(isEmptyPeriod(resume(0, 2))).toBe(false)
    expect(isEmptyPeriod(undefined)).toBe(false)
  })
})
