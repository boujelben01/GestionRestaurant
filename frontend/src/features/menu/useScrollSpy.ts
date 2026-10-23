import { useCallback, useEffect, useRef, useState } from 'react'

export const categoryAnchor = (id: number) => `cat-${id}`

/**
 * Scroll-spy des sections de catégories (IntersectionObserver). `offset` = hauteur du header +
 * barre collante. Renvoie la catégorie active et `select(id)` qui défile en douceur (instantané
 * si prefers-reduced-motion) en neutralisant brièvement l'observation pour éviter les sauts.
 */
export function useScrollSpy(ids: number[], offset = 140) {
  const [observed, setObserved] = useState<number | null>(null)
  const lockUntil = useRef(0)
  const key = ids.join(',')

  useEffect(() => {
    const list = key ? key.split(',').map(Number) : []
    if (list.length === 0 || typeof IntersectionObserver === 'undefined') return
    const visible = new Set<number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = Number(entry.target.id.slice('cat-'.length))
          if (entry.isIntersecting) visible.add(id)
          else visible.delete(id)
        }
        if (Date.now() < lockUntil.current) return
        const first = list.find((id) => visible.has(id))
        if (first !== undefined) setObserved(first)
      },
      { rootMargin: `-${offset}px 0px -55% 0px` },
    )
    for (const id of list) {
      const el = document.getElementById(categoryAnchor(id))
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [key, offset])

  const activeId = observed !== null && ids.includes(observed) ? observed : (ids[0] ?? null)

  const select = useCallback((id: number) => {
    setObserved(id)
    lockUntil.current = Date.now() + 900
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    document
      .getElementById(categoryAnchor(id))
      ?.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' })
  }, [])

  return { activeId, select }
}
