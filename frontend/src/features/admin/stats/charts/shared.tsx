import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { patternFill, type PatternKind } from './chartUtils'

/** Définitions de motifs SVG ; `id` doit être unique dans la page (useId). */
export function PatternDefs({ id }: { id: string }) {
  return (
    <defs>
      <pattern
        id={`${id}-stripes`}
        width="6"
        height="6"
        patternUnits="userSpaceOnUse"
        patternTransform="rotate(45)"
      >
        <rect width="6" height="6" fill="#fff" />
        <rect width="3" height="6" fill="currentColor" />
      </pattern>
      <pattern id={`${id}-dots`} width="6" height="6" patternUnits="userSpaceOnUse">
        <rect width="6" height="6" fill="#fff" />
        <circle cx="3" cy="3" r="1.8" fill="currentColor" />
      </pattern>
    </defs>
  )
}

/** Pastille de légende : même couleur ET même motif que la forme du graphique. */
export function Swatch({ color, pattern }: { color: string; pattern: PatternKind }) {
  const id = useId()
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 18 18"
      className="shrink-0"
      style={{ color }}
    >
      <PatternDefs id={id} />
      <rect
        width="18"
        height="18"
        rx="4"
        fill={patternFill(id, pattern, color)}
        stroke={color}
        strokeWidth="1.5"
      />
    </svg>
  )
}

export interface SrTableProps {
  caption: string
  headers: readonly string[]
  rows: ReadonlyArray<ReadonlyArray<string | number>>
}

/** Tableau de données équivalent, masqué visuellement (lecteurs d'écran). */
export function SrTable({ caption, headers, rows }: SrTableProps) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {headers.map((h) => (
            <th key={h} scope="col">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={index}>
            {row.map((cell, i) =>
              i === 0 ? (
                <th key={i} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={i}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface ChartFigureProps {
  title: string
  /** Résumé en une phrase (« Meilleur jour : 14 juin, 312 DT »). */
  summary: string
  table: SrTableProps
  className?: string
  children: ReactNode
}

/** <figure> + <figcaption> (titre et résumé) ; le tableau équivalent suit pour les lecteurs d'écran. */
export function ChartFigure({ title, summary, table, className, children }: ChartFigureProps) {
  return (
    <figure
      className={cn('flex flex-col gap-3 rounded-lg bg-white p-4 shadow-soft sm:p-5', className)}
    >
      <figcaption>
        <h3 className="font-display text-xl font-semibold">{title}</h3>
        <p className="mt-0.5 text-sm text-ink-700">{summary}</p>
      </figcaption>
      {children}
      <SrTable {...table} />
    </figure>
  )
}
