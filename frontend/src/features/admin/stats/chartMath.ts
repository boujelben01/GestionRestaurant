import type { Breakdown, PeakHour, SalesDay, StatsResume } from '@/lib/types'

/** Plus petite « belle » valeur (1, 2, 2,5, 5 × 10^k) au moins égale à `max` : borne haute d'un axe. */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1
  const exponent = Math.floor(Math.log10(max))
  const base = 10 ** exponent
  const fraction = max / base
  const step = [1, 2, 2.5, 5, 10].find((s) => fraction <= s + 1e-9) ?? 10
  return round(step * base)
}

/** Graduations régulières de 0 à `niceMax(max)` (count + 1 valeurs). */
export function ticks(max: number, count = 4): number[] {
  const top = niceMax(max)
  return Array.from({ length: count + 1 }, (_, i) => round((top / count) * i))
}

const round = (n: number) => Math.round(n * 1e6) / 1e6

export const sum = (values: readonly number[]) => values.reduce((a, b) => a + b, 0)

/** Part en % (0-100) d'une valeur dans un total ; 0 si le total est nul. */
export function share(value: number, total: number): number {
  return total <= 0 ? 0 : (value / total) * 100
}

/** Heure de pointe : celle qui compte le plus de commandes (la plus tôt en cas d'égalité) ; null si aucune commande. */
export function busiestHour(hours: readonly PeakHour[]): PeakHour | null {
  const best = hours.reduce<PeakHour | null>(
    (acc, h) => (h.commandes > (acc?.commandes ?? 0) ? h : acc),
    null,
  )
  return best && best.commandes > 0 ? best : null
}

/** Meilleur jour de la période par chiffre d'affaires ; null si aucune vente. */
export function bestDay(days: readonly SalesDay[]): SalesDay | null {
  const best = days.reduce<SalesDay | null>(
    (acc, d) => (d.chiffreAffaires > (acc?.chiffreAffaires ?? 0) ? d : acc),
    null,
  )
  return best && best.chiffreAffaires > 0 ? best : null
}

/** Aucune vente ni annulation sur la période : on affiche l'état vide plutôt que des graphiques à plat. */
export function isEmptyPeriod(resume: Pick<StatsResume, 'periode'> | undefined): boolean {
  return !!resume && resume.periode.nombreCommandes === 0 && resume.periode.nombreAnnulees === 0
}

/** Données du donut : uniquement les parts non nulles, pour ne pas dessiner d'arcs vides. */
export function donutSlices<T extends { commandes: number }>(
  rows: readonly T[],
): Array<T & { percent: number }> {
  const total = sum(rows.map((r) => r.commandes))
  return rows
    .filter((r) => r.commandes > 0)
    .map((r) => ({ ...r, percent: share(r.commandes, total) }))
}

export const categoryTotal = (rows: Breakdown['parCategorie']) =>
  sum(rows.map((r) => r.chiffreAffaires))
