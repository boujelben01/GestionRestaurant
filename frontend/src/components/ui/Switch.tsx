import { useId } from 'react'
import { cn } from '@/lib/cn'

interface SwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Libellé visible à côté de l'interrupteur. */
  label: string
  /** Texte réservé aux lecteurs d'écran en complément (ex. nom de l'élément concerné). */
  srContext?: string
  disabled?: boolean
  className?: string
}

/** Interrupteur accessible (role="switch", clavier Espace/Entrée), zone tactile de 44 px. */
export function Switch({ checked, onChange, label, srContext, disabled, className }: SwitchProps) {
  const id = useId()
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={srContext ? `${srContext} : ${label}` : undefined}
        aria-disabled={disabled || undefined}
        onClick={() => !disabled && onChange(!checked)}
        className="group grid min-h-11 min-w-12 place-items-center rounded-full aria-disabled:opacity-50"
      >
        <span
          aria-hidden="true"
          className={cn(
            'relative block h-7 w-12 rounded-full transition-colors duration-200',
            checked ? 'bg-olive-700' : 'bg-sand-400',
          )}
        >
          <span
            className={cn(
              'absolute start-1 top-1 block size-5 rounded-full bg-white shadow-soft transition-transform duration-200',
              checked && 'translate-x-5 rtl:-translate-x-5',
            )}
          />
        </span>
      </button>
      <label htmlFor={id} className="cursor-pointer text-sm font-semibold select-none">
        {label}
      </label>
    </span>
  )
}
