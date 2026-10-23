import type { StatutCommande } from '@/lib/types'

/**
 * Transitions valides, identiques à StatutTransitions côté back-end (le serveur reste l'autorité :
 * un 409 est toujours possible). L'interface ne propose QUE ces boutons.
 */
const NEXT: Record<StatutCommande, readonly StatutCommande[]> = {
  EnAttente: ['EnPreparation', 'Annulee'],
  EnPreparation: ['Prete', 'Annulee'],
  Prete: ['Terminee', 'Annulee'],
  Terminee: [],
  Annulee: [],
}

export const BOARD_STATUSES = [
  'EnAttente',
  'EnPreparation',
  'Prete',
] as const satisfies readonly StatutCommande[]
export type BoardStatus = (typeof BOARD_STATUSES)[number]

export const nextStatuses = (statut: StatutCommande): readonly StatutCommande[] => NEXT[statut]

export const isFinalStatut = (statut: StatutCommande) => NEXT[statut].length === 0

/** Action principale (avancer d'une étape) : première transition qui n'est pas une annulation. */
export const advanceTarget = (statut: StatutCommande): StatutCommande | null =>
  NEXT[statut].find((s) => s !== 'Annulee') ?? null

export const canTransition = (from: StatutCommande, to: StatutCommande) => NEXT[from].includes(to)

/** Après ce changement, la commande quitte-t-elle l'écran « actives » ? */
export const leavesBoard = (to: StatutCommande) => to === 'Terminee' || to === 'Annulee'

/** Seuils d'ancienneté (minutes) au-delà desquels la carte passe en rouge, par statut. */
export const LATE_AFTER_MINUTES: Record<BoardStatus, number> = {
  EnAttente: 5,
  EnPreparation: 20,
  Prete: 10,
}

export function ageMinutes(isoDate: string, now: number = Date.now()): number {
  return Math.max(0, Math.floor((now - new Date(isoDate).getTime()) / 60_000))
}

/**
 * L'ancienneté se mesure depuis la dernière mise à jour du statut courant (dateMiseAJour) pour juger
 * le retard de l'étape en cours ; la colonne « EnAttente » compte depuis la commande.
 */
export function isLate(statut: StatutCommande, minutes: number): boolean {
  return statut in LATE_AFTER_MINUTES && minutes >= LATE_AFTER_MINUTES[statut as BoardStatus]
}
