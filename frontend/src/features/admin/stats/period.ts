/**
 * Période du tableau de bord : jours civils de Tunis (AAAA-MM-JJ), bornes incluses, 366 jours au plus
 * (règle du back-end). Elle vit dans l'URL (?du=&au=) pour pouvoir être partagée et rechargée.
 */
export const MAX_DAYS = 366
export const DEFAULT_DAYS = 30
export const PRESETS = [7, 30, 90] as const
export type PresetDays = (typeof PRESETS)[number]
export type PeriodPreset = `${PresetDays}` | 'custom'

export interface Period {
  du: string
  au: string
}

const DAY_MS = 86_400_000
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Jour civil courant à Tunis (AAAA-MM-JJ), quel que soit le fuseau du navigateur. */
export function tunisToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Tunis',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

const toUtcMs = (date: string) =>
  Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10))

/** Vrai pour une vraie date de calendrier au format AAAA-MM-JJ (« 2024-02-30 » est refusée). */
export function isValidDate(value: string | null | undefined): value is string {
  if (!value || !DATE_RE.test(value)) return false
  const ms = toUtcMs(value)
  return new Date(ms).toISOString().slice(0, 10) === value
}

export function addDays(date: string, days: number): string {
  return new Date(toUtcMs(date) + days * DAY_MS).toISOString().slice(0, 10)
}

/** Nombre de jours de la période, bornes incluses. */
export function daysIn(period: Period): number {
  return Math.round((toUtcMs(period.au) - toUtcMs(period.du)) / DAY_MS) + 1
}

/** « 7 derniers jours » : se termine aujourd'hui, aujourd'hui compris. */
export function presetPeriod(days: PresetDays | number, today: string): Period {
  return { du: addDays(today, 1 - days), au: today }
}

export const DEFAULT_PERIOD = (today: string): Period => presetPeriod(DEFAULT_DAYS, today)

export function isAcceptable(period: Period): boolean {
  return (
    isValidDate(period.du) &&
    isValidDate(period.au) &&
    period.du <= period.au &&
    daysIn(period) <= MAX_DAYS
  )
}

export interface ResolvedPeriod {
  period: Period
  /** Vrai si les paramètres d'URL étaient invalides : on est revenu à la période par défaut. */
  invalid: boolean
}

/**
 * Lit ?du=&au= . Absents : 30 derniers jours. Seul `du` : jusqu'à aujourd'hui. Seul `au` : les 30 jours
 * qui précèdent. Invalides, inversés ou trop longs : période par défaut, avec `invalid: true`.
 */
export function resolvePeriod(params: URLSearchParams, today: string): ResolvedPeriod {
  const rawDu = params.get('du')
  const rawAu = params.get('au')
  if (!rawDu && !rawAu) return { period: DEFAULT_PERIOD(today), invalid: false }
  if ((rawDu && !isValidDate(rawDu)) || (rawAu && !isValidDate(rawAu))) {
    return { period: DEFAULT_PERIOD(today), invalid: true }
  }
  const au = rawAu ?? today
  const du = rawDu ?? addDays(au, 1 - DEFAULT_DAYS)
  const period = { du, au }
  return isAcceptable(period)
    ? { period, invalid: false }
    : { period: DEFAULT_PERIOD(today), invalid: true }
}

export function periodToParams(period: Period): URLSearchParams {
  return new URLSearchParams({ du: period.du, au: period.au })
}

/** « 7 » | « 30 » | « 90 » si la période est exactement les N derniers jours jusqu'à aujourd'hui, sinon « custom ». */
export function detectPreset(period: Period, today: string): PeriodPreset {
  if (period.au !== today) return 'custom'
  const match = PRESETS.find((days) => daysIn(period) === days)
  return match ? (`${match}` as PeriodPreset) : 'custom'
}

/** Erreur de saisie d'une période personnalisée (codes traduits par l'UI) ou undefined si elle est valide. */
export type PeriodError = 'invalid' | 'order' | 'tooLong'

export function validateCustom(du: string, au: string): PeriodError | undefined {
  if (!isValidDate(du) || !isValidDate(au)) return 'invalid'
  if (du > au) return 'order'
  if (daysIn({ du, au }) > MAX_DAYS) return 'tooLong'
  return undefined
}
