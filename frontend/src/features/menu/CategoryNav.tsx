import { useEffect, useRef } from 'react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import type { MenuCategorie } from '@/lib/types'

interface CategoryNavProps {
  categories: Pick<MenuCategorie, 'id' | 'nom'>[]
  activeId: number | null
  onSelect: (id: number) => void
}

/** Barre collante de catégories : défilement horizontal, pastille animée (layout) sur l'active. */
export function CategoryNav({ categories, activeId, onSelect }: CategoryNavProps) {
  const { t } = useTranslation()
  const navRef = useRef<HTMLElement>(null)

  // Garde la catégorie active visible dans la barre (fonctionne aussi en RTL : rects absolus).
  useEffect(() => {
    const nav = navRef.current
    const chip = nav?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!nav || !chip) return
    const navBox = nav.getBoundingClientRect()
    const chipBox = chip.getBoundingClientRect()
    const delta = chipBox.left + chipBox.width / 2 - (navBox.left + navBox.width / 2)
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    nav.scrollBy({ left: delta, behavior: reduced ? 'auto' : 'smooth' })
  }, [activeId])

  return (
    <nav
      ref={navRef}
      aria-label={t('menu.categoriesNav')}
      className="no-scrollbar -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max min-w-full gap-1.5 py-2 sm:w-auto sm:flex-wrap">
        {categories.map((category) => {
          const active = category.id === activeId
          return (
            <li key={category.id}>
              <button
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(category.id)}
                className={cn(
                  'relative inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200',
                  active ? 'text-sand-50' : 'text-ink-700 hover:bg-sand-200/70',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="menu-category-pill"
                    className="absolute inset-0 rounded-full bg-ink-900"
                    transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                  />
                )}
                <span className="relative">{category.nom}</span>
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
