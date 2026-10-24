import type { Lang } from '@/lib/types'

export type VariationDirection = 'up' | 'down' | 'flat' | 'none'
export type VariationTone = 'good' | 'bad' | 'neutral'

/** Écart sous lequel la variation arrondie vaut 0,0 % : on la présente comme « stable ». */
const FLAT_BELOW = 0.05

export function variationDirection(value: number | null | undefined): VariationDirection {
  if (value === null || value === undefined || Number.isNaN(value)) return 'none'
  if (Math.abs(value) < FLAT_BELOW) return 'flat'
  return value > 0 ? 'up' : 'down'
}

/**
 * Tonalité de la variation. Une hausse est « bonne » pour le chiffre d'affaires, mais « mauvaise » pour les
 * annulations ou le montant à encaisser (`higherIsBetter: false`). Toujours doublée d'une flèche et d'un texte :
 * la couleur ne porte jamais seule l'information.
 */
export function variationTone(
  value: number | null | undefined,
  higherIsBetter = true,
): VariationTone {
  const direction = variationDirection(value)
  if (direction === 'none' || direction === 'flat') return 'neutral'
  return (direction === 'up') === higherIsBetter ? 'good' : 'bad'
}

export const VARIATION_ARROW: Record<VariationDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
  none: '–',
}

const LOCALES: Record<Lang, string> = { fr: 'fr-TN', ar: 'ar-TN' }

/** « +12,5 % », « −3,0 % », « 0,0 % » ; null : « — » (pas de période précédente comparable). */
export function formatVariation(value: number | null | undefined, lang: Lang): string {
  if (variationDirection(value) === 'none') return '—'
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format((value as number) / 100)
}
