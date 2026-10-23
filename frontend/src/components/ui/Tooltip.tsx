import { cloneElement, useId, useState, type ReactElement } from 'react'
import { cn } from '@/lib/cn'

interface TooltipProps {
  content: string
  /** Un seul élément focusable (utiliser aria-disabled plutôt que disabled pour qu'il le reste). */
  children: ReactElement<{ 'aria-describedby'?: string }>
  placement?: 'top' | 'bottom'
  /** Alignement horizontal de la bulle par rapport au déclencheur (logique : début/fin). */
  align?: 'start' | 'center' | 'end'
}

const alignment = {
  start: 'start-0',
  center: 'start-1/2 -translate-x-1/2 rtl:translate-x-1/2',
  end: 'end-0',
}

/**
 * Infobulle accessible : visible au survol ET au focus clavier/tactile, fermée par Échap,
 * reliée au déclencheur via aria-describedby.
 */
export function Tooltip({
  content,
  children,
  placement = 'bottom',
  align = 'center',
}: TooltipProps) {
  const [open, setOpen] = useState(false)
  const id = useId()

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
    >
      {cloneElement(children, { 'aria-describedby': id })}
      <span
        className={cn(
          'pointer-events-none absolute z-40 w-max max-w-56',
          placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
          alignment[align],
        )}
      >
        {open && (
          <span
            id={id}
            role="tooltip"
            className="block animate-fade-in rounded-md bg-ink-900 px-3 py-2 text-xs font-medium text-sand-50 shadow-float"
          >
            {content}
          </span>
        )}
      </span>
      {!open && (
        <span id={id} hidden>
          {content}
        </span>
      )}
    </span>
  )
}
