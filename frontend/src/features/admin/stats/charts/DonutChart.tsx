import { useId } from 'react'
import { useTranslation } from 'react-i18next'
import { COLORS, patternFill, type PatternKind } from './chartUtils'
import { ChartFigure, PatternDefs, Swatch, type SrTableProps } from './shared'

export interface DonutSlice {
  key: string
  label: string
  value: number
  percent: number
  /** Texte de pourcentage formaté. */
  percentText: string
  color: string
  pattern: PatternKind
}

const CX = 100
const CY = 100
const R_OUT = 90
const R_IN = 54

function polar(r: number, angle: number) {
  return [CX + r * Math.sin(angle), CY - r * Math.cos(angle)] as const
}

/** Secteur d'anneau entre deux angles (radians, 0 = haut, sens horaire). */
function arc(a0: number, a1: number) {
  const sweep = Math.min(a1, a0 + Math.PI * 2 - 0.0001)
  const large = sweep - a0 > Math.PI ? 1 : 0
  const [x0, y0] = polar(R_OUT, a0)
  const [x1, y1] = polar(R_OUT, sweep)
  const [x2, y2] = polar(R_IN, sweep)
  const [x3, y3] = polar(R_IN, a0)
  return `M${x0} ${y0} A${R_OUT} ${R_OUT} 0 ${large} 1 ${x1} ${y1} L${x2} ${y2} A${R_IN} ${R_IN} 0 ${large} 0 ${x3} ${y3} Z`
}

interface DonutChartProps {
  title: string
  summary: string
  slices: readonly DonutSlice[]
  /** Valeur au centre (total) et son libellé. */
  centerValue: string
  centerLabel: string
  table: SrTableProps
}

/** Anneau + légende (couleur, motif, effectif et pourcentage) : l'information ne repose pas sur la couleur. */
export function DonutChart({
  title,
  summary,
  slices,
  centerValue,
  centerLabel,
  table,
}: DonutChartProps) {
  const { t } = useTranslation()
  const id = useId()
  const paths = slices.map((slice, index) => {
    const before = slices.slice(0, index).reduce((n, s) => n + s.percent, 0)
    const a0 = (before / 100) * Math.PI * 2
    return { slice, d: arc(a0, a0 + (slice.percent / 100) * Math.PI * 2) }
  })

  return (
    <ChartFigure title={title} summary={summary} table={table}>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
        <svg
          style={{ direction: 'ltr' }}
          viewBox="0 0 200 200"
          role="img"
          aria-label={summary}
          className="block size-44 shrink-0 sm:size-48"
        >
          <PatternDefs id={id} />
          {paths.map(({ slice, d }) => (
            <path
              key={slice.key}
              d={d}
              fill={patternFill(id, slice.pattern, slice.color)}
              stroke="#fff"
              strokeWidth="2"
              style={{ color: slice.color }}
              className="chart-fade"
            />
          ))}
          <text
            x={CX}
            y={CY + 2}
            textAnchor="middle"
            fontSize="26"
            fontWeight="700"
            fill={COLORS.text}
          >
            {centerValue}
          </text>
          <text x={CX} y={CY + 20} textAnchor="middle" fontSize="11" fill={COLORS.text}>
            {centerLabel}
          </text>
        </svg>
        <ul className="flex w-full flex-col gap-2 sm:w-auto" aria-label={t('admin.stats.legend')}>
          {slices.map((slice) => (
            <li key={slice.key} className="flex items-center gap-2 text-sm">
              <Swatch color={slice.color} pattern={slice.pattern} />
              <span className="font-semibold">{slice.label}</span>
              <span className="tabular ms-auto ps-4 text-ink-700">
                {slice.value} · {slice.percentText}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </ChartFigure>
  )
}
