import { COLORS } from './chartUtils'
import { ChartFigure, type SrTableProps } from './shared'

export interface HBarRow {
  key: string
  label: string
  /** Longueur de la barre (valeur brute ; la plus grande remplit la largeur). */
  value: number
  /** Texte de valeur à droite de la barre (quantité, montant, pourcentage…). */
  valueText: string
  /** Texte secondaire sous le libellé. */
  sub?: string
}

interface HBarListProps {
  title: string
  summary: string
  rows: readonly HBarRow[]
  color?: string
  table: SrTableProps
}

/**
 * Barres horizontales à étiquettes directes (libellé, valeur écrite) : aucune lecture ne dépend de la couleur.
 * Chaque barre est un SVG à largeur fluide (dimensions fixes en hauteur : pas de décalage de mise en page).
 */
export function HBarList({ title, summary, rows, color = COLORS.orders, table }: HBarListProps) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ChartFigure title={title} summary={summary} table={table}>
      <ul className="flex flex-col gap-3" role="img" aria-label={summary}>
        {rows.map((row) => (
          <li key={row.key} className="grid gap-1">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 font-semibold break-words">{row.label}</span>
              <span className="tabular shrink-0 font-bold">{row.valueText}</span>
            </div>
            <svg
              aria-hidden="true"
              viewBox="0 0 100 10"
              preserveAspectRatio="none"
              className="block h-3 w-full overflow-visible"
              style={{ color }}
            >
              <rect width="100" height="10" rx="2" fill="#f4ecdd" />
              <rect
                width={Math.max(row.value > 0 ? 1.5 : 0, (row.value / max) * 100)}
                height="10"
                rx="2"
                fill={color}
                className="chart-grow"
              />
            </svg>
            {row.sub && <p className="tabular text-xs text-ink-500">{row.sub}</p>}
          </li>
        ))}
      </ul>
    </ChartFigure>
  )
}
