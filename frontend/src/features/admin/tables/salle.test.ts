import { describe, expect, it } from 'vitest'
import type { SalleOrder, SalleTable, StatutCommande } from '@/lib/types'
import {
  applyCollect,
  applyRelease,
  canCollect,
  canRelease,
  computeEtat,
  isTracked,
  occupationMinutes,
  releaseBlockers,
  salleSummary,
} from './salle'

const order = (id: number, statut: StatutCommande, estPayee = false, total = 7): SalleOrder => ({
  id,
  numero: `CMD-${id}`,
  statut,
  total,
  estPayee,
  dateCommande: `2024-06-01T1${id}:00:00Z`,
})

const table = (commandes: SalleOrder[], over: Partial<SalleTable> = {}): SalleTable => ({
  id: 1,
  numero: 4,
  capacite: 4,
  estActive: true,
  etat: computeEtat(true, commandes),
  totalAEncaisser: commandes.filter((c) => !c.estPayee).reduce((n, c) => n + c.total, 0),
  nombreCommandes: commandes.length,
  premiereCommandeUtc: commandes[0]?.dateCommande ?? null,
  commandes,
  ...over,
})

describe('états de la salle (miroir du back-end)', () => {
  it('Libre : aucune commande suivie', () => {
    expect(computeEtat(true, [])).toBe('Libre')
  })

  it.each(['EnAttente', 'EnPreparation', 'Prete'] as const)(
    'Occupee : une commande %s, payée ou non',
    (statut) => {
      expect(computeEtat(true, [order(1, statut)])).toBe('Occupee')
      expect(computeEtat(true, [order(1, statut, true)])).toBe('Occupee')
    },
  )

  it('AEncaisser : plus rien en cours mais une commande terminée non payée', () => {
    expect(computeEtat(true, [order(1, 'Terminee')])).toBe('AEncaisser')
  })

  it("Occupee l'emporte sur AEncaisser", () => {
    expect(computeEtat(true, [order(1, 'Terminee'), order(2, 'EnPreparation')])).toBe('Occupee')
  })

  it('Inactive est prioritaire sur tout', () => {
    expect(computeEtat(false, [])).toBe('Inactive')
    expect(computeEtat(false, [order(1, 'EnAttente')])).toBe('Inactive')
  })

  it.each([
    ['EnAttente', false, true],
    ['Prete', true, true],
    ['Terminee', false, true],
    ['Terminee', true, false],
    ['Annulee', false, false],
  ] as const)('commande %s (payée : %s) suivie : %s', (statut, paid, tracked) => {
    expect(isTracked(statut, paid)).toBe(tracked)
  })
})

describe('encaisser', () => {
  it("n'est possible que s'il reste une commande non payée", () => {
    expect(canCollect(table([order(1, 'Prete')]))).toBe(true)
    expect(canCollect(table([order(1, 'Prete', true)]))).toBe(false)
    expect(canCollect(table([]))).toBe(false)
  })

  it('aperçu : tout devient payé, le total à encaisser tombe à 0, la table reste occupée si des commandes sont en cours', () => {
    const next = applyCollect(
      table([order(1, 'EnPreparation', false, 7), order(2, 'Prete', false, 3.5)]),
    )

    expect(next.totalAEncaisser).toBe(0)
    expect(next.commandes.every((c) => c.estPayee)).toBe(true)
    expect(next.etat).toBe('Occupee')
    expect(next.nombreCommandes).toBe(2)
  })

  it('aperçu : des commandes terminées sont payées donc quittent la salle, la table se libère', () => {
    const next = applyCollect(
      table([order(1, 'Terminee', false, 10), order(2, 'Terminee', false, 4)]),
    )

    expect(next.etat).toBe('Libre')
    expect(next.commandes).toEqual([])
    expect(next.nombreCommandes).toBe(0)
    expect(next.premiereCommandeUtc).toBeNull()
  })

  it('aperçu : une table inactive reste inactive', () => {
    const next = applyCollect(table([order(1, 'Terminee')], { estActive: false, etat: 'Inactive' }))
    expect(next.etat).toBe('Inactive')
  })
})

describe('libérer', () => {
  it('liste ce qui bloque : commandes en cours et commandes non payées', () => {
    expect(
      releaseBlockers(
        table([
          order(1, 'EnAttente'),
          order(2, 'EnPreparation', true),
          order(3, 'Prete'),
          order(4, 'Terminee'),
        ]),
      ),
    ).toEqual({ inProgress: 2, unpaid: 3 })
    expect(canRelease(table([order(1, 'Prete', true)]))).toBe(true)
    expect(canRelease(table([]))).toBe(true)
    expect(canRelease(table([order(1, 'Prete')]))).toBe(false)
    expect(canRelease(table([order(1, 'EnAttente', true)]))).toBe(false)
  })

  it('aperçu : les commandes prêtes et payées se terminent et la table se libère', () => {
    const next = applyRelease(table([order(1, 'Prete', true), order(2, 'Prete', true)]))

    expect(next.etat).toBe('Libre')
    expect(next.commandes).toEqual([])
  })

  it("aperçu : s'il y a un blocage, l'état affiché ne change pas (le serveur refusera en 409)", () => {
    const blocked = table([order(1, 'EnPreparation', true)])
    expect(applyRelease(blocked)).toBe(blocked)
  })
})

describe('résumé et durée', () => {
  it('compte les tables libres, occupées, à encaisser et inactives', () => {
    expect(
      salleSummary([
        { etat: 'Libre' },
        { etat: 'Libre' },
        { etat: 'Occupee' },
        { etat: 'AEncaisser' },
        { etat: 'Inactive' },
      ]),
    ).toEqual({ libres: 2, occupees: 1, aEncaisser: 1, inactives: 1 })
    expect(salleSummary([])).toEqual({ libres: 0, occupees: 0, aEncaisser: 0, inactives: 0 })
  })

  it("durée d'occupation en minutes entières, jamais négative, null sans commande", () => {
    const now = new Date('2024-06-01T12:00:00Z').getTime()
    expect(occupationMinutes('2024-06-01T11:15:30Z', now)).toBe(44)
    expect(occupationMinutes('2024-06-01T12:30:00Z', now)).toBe(0)
    expect(occupationMinutes(null, now)).toBeNull()
  })
})
