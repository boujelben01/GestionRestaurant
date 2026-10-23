import { useId } from 'react'
import { cn } from '@/lib/cn'

/** Étoile à 8 branches : deux carrés superposés, tracé fin (couleur = currentColor). */
function Star({ cx, cy, r }: { cx: number; cy: number; r: number }) {
  const side = r * Math.SQRT2
  const props = { x: cx - side / 2, y: cy - side / 2, width: side, height: side }
  return (
    <g fill="none" stroke="currentColor" strokeWidth="1" strokeLinejoin="round">
      <rect {...props} />
      <rect {...props} transform={`rotate(45 ${cx} ${cy})`} />
    </g>
  )
}

interface PatternProps {
  className?: string
  /** Taille d'une tuile en px. */
  size?: number
}

/**
 * Fond de carreaux (étoiles à 8 branches) en SVG léger ; couleur = `currentColor`,
 * à doser via text-* et opacity-*. Décoratif : aria-hidden, pointer-events none.
 */
export function ZelligePattern({ className, size = 56 }: PatternProps) {
  const id = useId()
  const c = size / 2
  const k = size * 0.12
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={cn('pointer-events-none absolute inset-0 size-full', className)}
    >
      <defs>
        <pattern id={id} width={size} height={size} patternUnits="userSpaceOnUse">
          <Star cx={c} cy={c} r={size * 0.34} />
          <path
            d={`M0 ${k}V0H${k}M${size - k} 0H${size}V${k}M${size} ${size - k}V${size}H${size - k}M${k} ${size}H0V${size - k}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  )
}

/** Séparateur : filet, étoile, filet. Décoratif (aria-hidden). */
export function ZelligeDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn('flex items-center gap-3 text-terracotta-500', className)}
    >
      <span className="h-px flex-1 bg-linear-to-r from-transparent to-current opacity-50 rtl:bg-linear-to-l" />
      <svg viewBox="0 0 32 32" className="size-6 shrink-0" focusable="false">
        <Star cx={16} cy={16} r={9} />
        <circle cx="16" cy="16" r="2.2" fill="#d4a63c" />
      </svg>
      <span className="h-px flex-1 bg-linear-to-l from-transparent to-current opacity-50 rtl:bg-linear-to-r" />
    </div>
  )
}
