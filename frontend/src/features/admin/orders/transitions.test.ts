import { describe, expect, it } from 'vitest'
import type { StatutCommande } from '@/lib/types'
import {
  advanceTarget,
  ageMinutes,
  canTransition,
  isFinalStatut,
  isLate,
  leavesBoard,
  nextStatuses,
} from './transitions'

const ALL: StatutCommande[] = ['EnAttente', 'EnPreparation', 'Prete', 'Terminee', 'Annulee']

describe('transitions proposées par statut (miroir de StatutTransitions)', () => {
  it.each([
    ['EnAttente', ['EnPreparation', 'Annulee']],
    ['EnPreparation', ['Prete', 'Annulee']],
    ['Prete', ['Terminee', 'Annulee']],
    ['Terminee', []],
    ['Annulee', []],
  ] as const)('%s → %j', (statut, expected) => {
    expect(nextStatuses(statut)).toEqual(expected)
  })

  it('exactement 6 transitions valides sur les 25 paires', () => {
    const valid = ALL.flatMap((from) =>
      ALL.filter((to) => canTransition(from, to)).map((to) => [from, to]),
    )
    expect(valid).toHaveLength(6)
    expect(canTransition('EnAttente', 'Terminee')).toBe(false)
    expect(canTransition('Annulee', 'EnAttente')).toBe(false)
    expect(canTransition('EnAttente', 'EnAttente')).toBe(false)
  })

  it("l'action principale avance d'une étape, jamais vers l'annulation", () => {
    expect(advanceTarget('EnAttente')).toBe('EnPreparation')
    expect(advanceTarget('EnPreparation')).toBe('Prete')
    expect(advanceTarget('Prete')).toBe('Terminee')
    expect(advanceTarget('Terminee')).toBeNull()
    expect(advanceTarget('Annulee')).toBeNull()
  })

  it("les statuts finaux n'ont aucune action", () => {
    expect(isFinalStatut('Terminee')).toBe(true)
    expect(isFinalStatut('Annulee')).toBe(true)
    expect(isFinalStatut('Prete')).toBe(false)
  })

  it("une commande terminée ou annulée quitte l'écran des actives", () => {
    expect(leavesBoard('Terminee')).toBe(true)
    expect(leavesBoard('Annulee')).toBe(true)
    expect(leavesBoard('Prete')).toBe(false)
  })
})

describe('ancienneté', () => {
  const now = new Date('2024-06-01T12:00:00Z').getTime()

  it('arrondit à la minute inférieure et ne devient jamais négative', () => {
    expect(ageMinutes('2024-06-01T11:52:59Z', now)).toBe(7)
    expect(ageMinutes('2024-06-01T12:00:30Z', now)).toBe(0)
  })

  it('passe en retard selon le statut', () => {
    expect(isLate('EnAttente', 4)).toBe(false)
    expect(isLate('EnAttente', 5)).toBe(true)
    expect(isLate('EnPreparation', 19)).toBe(false)
    expect(isLate('EnPreparation', 20)).toBe(true)
    expect(isLate('Terminee', 999)).toBe(false)
  })
})
