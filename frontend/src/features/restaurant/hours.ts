import type { Horaire } from '@/lib/types'

/** Semaine affichée du lundi au dimanche ; l'API numérote 0 = dimanche. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export type DayHours =
  | { kind: 'closed' }
  /** `overnight` : la fermeture tombe après minuit (fermeture < ouverture). */
  | { kind: 'open'; open: string; close: string; overnight: boolean }

/** Normalise un créneau de l'API : fermé si `estFerme` ou si une heure manque. */
export function describeHours(horaire: Horaire | undefined): DayHours {
  if (!horaire || horaire.estFerme || !horaire.ouverture || !horaire.fermeture) {
    return { kind: 'closed' }
  }
  return {
    kind: 'open',
    open: horaire.ouverture,
    close: horaire.fermeture,
    // « HH:mm » : la comparaison lexicographique suffit.
    overnight: horaire.fermeture < horaire.ouverture,
  }
}

export interface WeekDay {
  /** 0 = dimanche … 6 = samedi. */
  day: number
  hours: DayHours
}

/** Les sept jours, lundi en premier, un jour absent de l'API étant considéré fermé. */
export function orderedWeek(horaires: Horaire[]): WeekDay[] {
  const byDay = new Map(horaires.map((h) => [h.jourSemaine, h]))
  return WEEK_ORDER.map((day) => ({ day, hours: describeHours(byDay.get(day)) }))
}

export function mapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
}
