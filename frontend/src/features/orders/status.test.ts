import { describe, expect, it } from 'vitest'
import { POLL_INTERVAL_MS, buildTimeline, canCancel, isFinalStatus, pollInterval } from './status'

const h = (statut: Parameters<typeof buildTimeline>[0], date: string) => ({ statut, date })

describe('buildTimeline', () => {
  it('commande en attente : 1re étape courante, les autres à venir', () => {
    const t = buildTimeline('EnAttente', [h('EnAttente', '2024-06-01T10:00:00Z')])
    expect(t.map((s) => s.state)).toEqual(['current', 'upcoming', 'upcoming', 'upcoming'])
    expect(t[0]?.date).toBe('2024-06-01T10:00:00Z')
    expect(t[1]?.date).toBeNull()
  })

  it('en préparation : une étape faite, une courante', () => {
    const t = buildTimeline('EnPreparation', [
      h('EnAttente', '2024-06-01T10:00:00Z'),
      h('EnPreparation', '2024-06-01T10:05:00Z'),
    ])
    expect(t.map((s) => s.state)).toEqual(['done', 'current', 'upcoming', 'upcoming'])
  })

  it('terminée : tout est fait', () => {
    const t = buildTimeline('Terminee', [])
    expect(t.map((s) => s.state)).toEqual(['done', 'done', 'done', 'done'])
  })

  it('annulée : étapes atteintes puis variante annulée', () => {
    const t = buildTimeline('Annulee', [
      h('EnAttente', '2024-06-01T10:00:00Z'),
      h('Annulee', '2024-06-01T10:01:00Z'),
    ])
    expect(t.map((s) => [s.statut, s.state])).toEqual([
      ['EnAttente', 'done'],
      ['Annulee', 'cancelled'],
    ])
  })
})

describe('polling et annulation', () => {
  it('poll toutes les 15 s tant que non final', () => {
    expect(POLL_INTERVAL_MS).toBe(15_000)
    expect(pollInterval('EnAttente')).toBe(15_000)
    expect(pollInterval('EnPreparation')).toBe(15_000)
    expect(pollInterval('Prete')).toBe(15_000)
    expect(pollInterval(undefined)).toBe(15_000)
  })

  it("s'arrête aux statuts finaux", () => {
    expect(pollInterval('Terminee')).toBe(false)
    expect(pollInterval('Annulee')).toBe(false)
    expect(isFinalStatus('Terminee')).toBe(true)
    expect(isFinalStatus('Prete')).toBe(false)
  })

  it('annulation seulement en attente', () => {
    expect(canCancel('EnAttente')).toBe(true)
    expect(canCancel('EnPreparation')).toBe(false)
  })
})
