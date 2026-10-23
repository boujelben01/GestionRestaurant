import type { Lang } from '@/lib/types'

const LOCALES: Record<Lang, string> = { fr: 'fr-TN', ar: 'ar-TN' }

/**
 * « il y a 7 minutes » / « il y a 2 heures » dans la langue active (pluriels gérés par Intl, y compris
 * les six formes arabes). Moins d'une minute : renvoie null (l'appelant affiche « à l'instant »).
 */
export function formatAge(minutes: number, lang: Lang): string | null {
  if (minutes < 1) return null
  const formatter = new Intl.RelativeTimeFormat(LOCALES[lang], { numeric: 'always' })
  return minutes < 60
    ? formatter.format(-minutes, 'minute')
    : formatter.format(-Math.floor(minutes / 60), 'hour')
}
