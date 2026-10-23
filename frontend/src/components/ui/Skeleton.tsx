import type { ComponentPropsWithoutRef } from 'react'
import { cn } from '@/lib/cn'

/** Bloc de chargement décoratif (opacité pulsée) ; masqué des lecteurs d'écran. */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('animate-pulse-soft rounded-md bg-sand-200', className)}
      {...props}
    />
  )
}
