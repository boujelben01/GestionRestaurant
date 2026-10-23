import type { HistoriqueStatut, StatutCommande } from '@/lib/types'

/** Parcours nominal d'une commande ; « Annulee » est une branche à part. */
export const STATUS_FLOW: readonly StatutCommande[] = [
  'EnAttente',
  'EnPreparation',
  'Prete',
  'Terminee',
]

export const FINAL_STATUSES: readonly StatutCommande[] = ['Terminee', 'Annulee']

export const isFinalStatus = (statut: StatutCommande) => FINAL_STATUSES.includes(statut)

/** Seule une commande en attente peut être annulée (409 sinon côté serveur). */
export const canCancel = (statut: StatutCommande) => statut === 'EnAttente'

export type StepState = 'done' | 'current' | 'upcoming' | 'cancelled'

export interface TimelineStep {
  statut: StatutCommande
  state: StepState
  /** Date ISO (UTC) à laquelle la commande a atteint ce statut, si connue. */
  date: string | null
}

/**
 * Construit la frise à partir de l'historique renvoyé par l'API.
 * - Commande normale : les 4 étapes du parcours ; celles atteintes sont « done », la dernière
 *   « current » (sauf Terminee qui est « done »), les suivantes « upcoming ».
 * - Commande annulée : les étapes réellement atteintes (historique) puis « Annulee ».
 */
export function buildTimeline(
  statut: StatutCommande,
  historique: readonly HistoriqueStatut[],
): TimelineStep[] {
  const dateOf = (s: StatutCommande) => historique.find((h) => h.statut === s)?.date ?? null

  if (statut === 'Annulee') {
    const reached = STATUS_FLOW.filter((s) => dateOf(s) !== null)
    return [
      ...reached.map((s) => ({ statut: s, state: 'done' as const, date: dateOf(s) })),
      { statut: 'Annulee', state: 'cancelled', date: dateOf('Annulee') },
    ]
  }

  const currentIndex = STATUS_FLOW.indexOf(statut)
  return STATUS_FLOW.map((s, index) => {
    let state: StepState = 'upcoming'
    if (index < currentIndex || statut === 'Terminee') state = 'done'
    else if (index === currentIndex) state = 'current'
    return { statut: s, state, date: dateOf(s) }
  })
}

export const POLL_INTERVAL_MS = 15_000

/** Intervalle de refetch : aucun une fois la commande terminée ou annulée. */
export function pollInterval(statut: StatutCommande | undefined): number | false {
  return statut && isFinalStatus(statut) ? false : POLL_INTERVAL_MS
}
