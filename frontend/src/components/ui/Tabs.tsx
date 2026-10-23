import { useRef, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'
import { panelId, tabId } from './tabIds'

export interface TabItem<T extends string> {
  id: T
  label: string
  /** Compteur affiché dans l'onglet (ex. nombre de commandes). */
  count?: number
}

interface TabsProps<T extends string> {
  tabs: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  label: string
  /** Préfixe des ids : onglet `${idPrefix}-tab-${id}`, panneau `${idPrefix}-panel-${id}`. */
  idPrefix: string
  className?: string
}

/** Onglets accessibles : flèches, Début/Fin, tabindex itinérant ; les panneaux sont rendus par l'appelant. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idPrefix,
  className,
}: TabsProps<T>) {
  const listRef = useRef<HTMLDivElement>(null)

  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.findIndex((t) => t.id === value)
    const rtl = document.documentElement.dir === 'rtl'
    let next: number
    if (event.key === (rtl ? 'ArrowLeft' : 'ArrowRight')) next = (index + 1) % tabs.length
    else if (event.key === (rtl ? 'ArrowRight' : 'ArrowLeft'))
      next = (index - 1 + tabs.length) % tabs.length
    else if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = tabs.length - 1
    else return
    event.preventDefault()
    const target = tabs[next]
    if (!target) return
    onChange(target.id)
    listRef.current?.querySelector<HTMLElement>(`#${tabId(idPrefix, target.id)}`)?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn(
        'no-scrollbar flex gap-1 overflow-x-auto rounded-full bg-sand-200/70 p-1',
        className,
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === value
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={tabId(idPrefix, tab.id)}
            aria-selected={selected}
            aria-controls={panelId(idPrefix, tab.id)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200',
              selected
                ? 'bg-ink-900 text-sand-50 shadow-soft'
                : 'text-ink-700 hover:bg-sand-300/60',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                className={cn(
                  'tabular grid min-w-6 place-items-center rounded-full px-1.5 text-xs leading-6 font-bold',
                  selected ? 'bg-white/20 text-white' : 'bg-white text-ink-700',
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
