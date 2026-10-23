import type { ComponentPropsWithoutRef, ElementType } from 'react'
import { cn } from '@/lib/cn'

type CardVariant = 'plain' | 'tinted' | 'outline'

interface CardProps extends ComponentPropsWithoutRef<'div'> {
  as?: ElementType
  variant?: CardVariant
  /** Léger soulèvement au survol (transform + calque d'ombre animé en opacité). */
  interactive?: boolean
}

const variants: Record<CardVariant, string> = {
  plain: 'bg-white shadow-soft',
  tinted: 'bg-sand-100',
  outline: 'border border-sand-300 bg-white/60',
}

export function Card({
  as: Tag = 'div',
  variant = 'plain',
  interactive = false,
  className,
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        'relative rounded-lg',
        variants[variant],
        interactive &&
          'transition-transform duration-300 ease-out-soft hover:-translate-y-1 ' +
            'after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:opacity-0 ' +
            'after:shadow-lift after:transition-opacity after:duration-300 hover:after:opacity-100',
        className,
      )}
      {...props}
    />
  )
}
