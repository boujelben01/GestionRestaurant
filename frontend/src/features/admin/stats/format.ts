import type { Lang } from '@/lib/types'

const LOCALES: Record<Lang, string> = { fr: 'fr-TN', ar: 'ar-TN' }

/** AAAA-MM-JJ → Date à minuit UTC : rendue avec timeZone 'UTC', aucun décalage de fuseau possible. */
const utc = (date: string) => new Date(`${date}T00:00:00Z`)

export type DayStyle = 'short' | 'withYear' | 'long'

/** « 14 juin », « 14 juin 2024 » ou « vendredi 14 juin 2024 » (jour civil, sans conversion de fuseau). */
export function formatCalendarDay(date: string, lang: Lang, style: DayStyle = 'short'): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'long',
    ...(style !== 'short' ? { year: 'numeric' } : {}),
    ...(style === 'long' ? { weekday: 'long' } : {}),
    timeZone: 'UTC',
  }).format(utc(date))
}

/** Jour court pour les axes : « 14 juin ». */
export function formatAxisDay(date: string, lang: Lang): string {
  if (!date) return ''
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(utc(date))
}

/** « 20 h » : heure pleine, nombre latin. */
export function formatHourLabel(hour: number, lang: Lang): string {
  const date = new Date(Date.UTC(2023, 0, 1, hour))
  return new Intl.DateTimeFormat(LOCALES[lang], {
    hour: 'numeric',
    hour12: false,
    timeZone: 'UTC',
  }).format(date)
}

/** Heure de Tunis « 14:05 » d'un horodatage (dataUpdatedAt). */
export function formatClock(timestamp: number, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Tunis',
  }).format(new Date(timestamp))
}

export function formatCompact(value: number, lang: Lang): string {
  return new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: 1 }).format(value)
}

export function formatPercent(value: number, lang: Lang, digits = 0): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'percent',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value / 100)
}
