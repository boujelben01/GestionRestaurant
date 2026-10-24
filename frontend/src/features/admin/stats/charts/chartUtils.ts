import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react'

/**
 * Palette des graphiques : tous ces tons ont un contraste d'au moins 3:1 sur fond blanc (WCAG 1.4.11).
 * Les séries se distinguent AUSSI par la forme (trait plein/pointillé, motif) et par des étiquettes directes.
 */
export const COLORS = {
  revenue: '#a94d2a', // terracotta-600 : 5,5:1
  orders: '#245784', // sidi-600 : 7,6:1
  olive: '#4b5629', // olive-700 : 7,9:1
  gold: '#7a5a12', // gold-800 : 6,6:1
  ink: '#6b5c50', // ink-500 : 6,0:1
  grid: '#d9c9ab', // sand-300 : traits secondaires (décoratifs)
  text: '#52443a', // ink-700 : étiquettes d'axe
} as const

export type PatternKind = 'solid' | 'stripes' | 'dots'

export const patternFill = (id: string, kind: PatternKind, color: string) =>
  kind === 'solid' ? color : `url(#${id}-${kind})`

/**
 * Curseur clavier/souris sur un graphique à `count` positions : flèches, Début, Fin ; Échap quitte.
 * Le conteneur reçoit UN seul tabindex (aucun piège clavier). Les axes restent de gauche à droite.
 */
export function useCursor(count: number) {
  const [active, setActive] = useState<number | null>(null)
  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') setActive((a) => Math.min(count - 1, (a ?? -1) + 1))
      else if (event.key === 'ArrowLeft') setActive((a) => Math.max(0, (a ?? count) - 1))
      else if (event.key === 'Home') setActive(0)
      else if (event.key === 'End') setActive(count - 1)
      else if (event.key === 'Escape') setActive(null)
      else return
      if (event.key !== 'Escape') event.preventDefault()
    },
    [count],
  )
  return { active, setActive, onKeyDown }
}

/**
 * Largeur réelle du conteneur (ResizeObserver) : les graphiques sont dessinés à l'échelle 1:1, donc leurs textes
 * gardent une taille lisible sur mobile comme sur grand écran. La hauteur reste fixe (pas de décalage de mise en page).
 */
export function useChartWidth(fallback = 640) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const element = ref.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0)
      if (next > 0) setWidth(next)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}
