import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

export type BadgeTone = 'neutral' | 'terracotta' | 'blue' | 'olive' | 'gold' | 'danger'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-sand-200 text-ink-800',
  terracotta: 'bg-terracotta-100 text-terracotta-700',
  blue: 'bg-sidi-100 text-sidi-700',
  olive: 'bg-olive-100 text-olive-700',
  gold: 'bg-gold-100 text-gold-800',
  danger: 'bg-danger-100 text-danger-800',
}

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  tone?: BadgeTone
  /** Petit point coloré avant le texte (état ouvert/fermé…). */
  dot?: boolean
}

export function Badge({
  tone = 'neutral',
  dot = false,
  className,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold',
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden="true" className="size-2 rounded-full bg-current" />}
      {children}
    </span>
  )
}
