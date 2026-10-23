import type { Lang } from '@/lib/types'

const LOCALES: Record<Lang, string> = { fr: 'fr-TN', ar: 'ar-TN' }

const cache = new Map<Lang, Intl.NumberFormat>()

/** Prix en dinars tunisiens, 2 décimales, formaté selon la langue (ex. « 12,50 DT »). */
export function formatPrice(amount: number, lang: Lang): string {
  let formatter = cache.get(lang)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALES[lang], {
      style: 'currency',
      currency: 'TND',
      currencyDisplay: 'narrowSymbol',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    cache.set(lang, formatter)
  }
  return formatter.format(amount)
}

/** Jour de la semaine localisé (0 = dimanche). */
export function weekdayName(jourSemaine: number, lang: Lang): string {
  // 2023-01-01 est un dimanche.
  const date = new Date(Date.UTC(2023, 0, 1 + jourSemaine))
  return new Intl.DateTimeFormat(LOCALES[lang], { weekday: 'long', timeZone: 'UTC' }).format(date)
}

/** Jour de la semaine courant dans le fuseau du restaurant (0 = dimanche). */
export function todayInTunis(now: Date = new Date()): number {
  const name = new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    timeZone: 'Africa/Tunis',
  }).format(now)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(name)
}

/** « 11:00 » → heure localisée lisible, sans changer de fuseau. */
export function formatTime(hhmm: string, lang: Lang): string {
  const [h = '0', m = '0'] = hhmm.split(':')
  const date = new Date(Date.UTC(2023, 0, 1, Number(h), Number(m)))
  return new Intl.DateTimeFormat(LOCALES[lang], {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'UTC',
  }).format(date)
}
