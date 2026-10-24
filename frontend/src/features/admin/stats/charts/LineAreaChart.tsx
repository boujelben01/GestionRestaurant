import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SalesDay } from '@/lib/types'
import { niceMax, ticks } from '../chartMath'
import { COLORS, useChartWidth, useCursor } from './chartUtils'
import { ChartFigure } from './shared'

export const LINE_H = 280
const M = { left: 58, right: 44, top: 14, bottom: 30 }

interface LineAreaChartProps {
  days: readonly SalesDay[]
  title: string
  summary: string
  /** Libellés formatés. */
  formatDay: (date: string) => string
  formatMoney: (value: number) => string
  formatAxis: (value: number) => string
}

/**
 * Chiffre d'affaires (aire + trait plein, axe de gauche) et commandes (trait pointillé, axe de droite).
 * Axe du temps de gauche à droite même en arabe (dir="ltr"). Parcours clavier : flèches ← → Début Fin.
 */
export function LineAreaChart({
  days,
  title,
  summary,
  formatDay,
  formatMoney,
  formatAxis,
}: LineAreaChartProps) {
  const { t } = useTranslation()
  const svgRef = useRef<SVGSVGElement>(null)
  const { ref: boxRef, width: LINE_W } = useChartWidth()
  const { active, setActive, onKeyDown } = useCursor(days.length)
  const [focused, setFocused] = useState(false)

  const plotW = LINE_W - M.left - M.right
  const plotH = LINE_H - M.top - M.bottom
  const maxCa = niceMax(Math.max(0, ...days.map((d) => d.chiffreAffaires)))
  const maxOrders = niceMax(Math.max(0, ...days.map((d) => d.commandes)))
  const n = days.length
  const x = (i: number) => M.left + (n <= 1 ? plotW / 2 : (plotW * i) / (n - 1))
  const yCa = (v: number) => M.top + plotH - (v / maxCa) * plotH
  const yOrd = (v: number) => M.top + plotH - (v / maxOrders) * plotH

  const line = (y: (v: number) => number, pick: (d: SalesDay) => number) =>
    days
      .map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(pick(d)).toFixed(1)}`)
      .join(' ')
  const caLine = line(yCa, (d) => d.chiffreAffaires)
  const ordLine = line(yOrd, (d) => d.commandes)
  const area =
    n > 0
      ? `${caLine} L${x(n - 1).toFixed(1)} ${M.top + plotH} L${x(0).toFixed(1)} ${M.top + plotH} Z`
      : ''

  const step = Math.max(1, Math.ceil((n - 1) / Math.max(2, Math.floor(plotW / 84))))
  const labelled = days
    .map((_, i) => i)
    .filter((i) => i % step === 0 && (n - 1 - i >= step / 2 || i === n - 1))
  const gridCa = ticks(maxCa, 4)

  const onMove = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || n === 0) return
    const px = ((clientX - rect.left) / rect.width) * LINE_W
    const ratio = (px - M.left) / plotW
    setActive(Math.max(0, Math.min(n - 1, Math.round(ratio * (n - 1)))))
  }

  const current = active !== null ? days[active] : undefined

  return (
    <ChartFigure
      title={title}
      summary={summary}
      table={{
        caption: title,
        headers: [t('admin.stats.date'), t('admin.stats.revenue'), t('admin.stats.orders')],
        rows: days.map((d) => [formatDay(d.date), formatMoney(d.chiffreAffaires), d.commandes]),
      }}
    >
      <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm font-semibold" aria-hidden="true">
        <li className="flex items-center gap-2">
          <svg width="28" height="10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="27"
              y2="5"
              stroke={COLORS.revenue}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
          {t('admin.stats.revenue')}
        </li>
        <li className="flex items-center gap-2">
          <svg width="28" height="10" aria-hidden="true">
            <line
              x1="1"
              y1="5"
              x2="27"
              y2="5"
              stroke={COLORS.orders}
              strokeWidth="2.5"
              strokeDasharray="5 4"
              strokeLinecap="round"
            />
          </svg>
          {t('admin.stats.orders')}
        </li>
      </ul>

      <div
        ref={boxRef}
        tabIndex={0}
        role="group"
        aria-label={t('admin.stats.chartKeyboard', { title })}
        onKeyDown={onKeyDown}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false)
          setActive(null)
        }}
        className="rounded-md outline-offset-4"
      >
        <svg
          ref={svgRef}
          style={{ direction: 'ltr' }}
          viewBox={`0 0 ${LINE_W} ${LINE_H}`}
          role="img"
          aria-label={summary}
          width={LINE_W}
          height={LINE_H}
          className="block w-full"
          onMouseMove={(event) => onMove(event.clientX)}
          onMouseLeave={() => setActive(null)}
        >
          {gridCa.map((value, index) => (
            <g key={value}>
              <line
                x1={M.left}
                x2={LINE_W - M.right}
                y1={yCa(value)}
                y2={yCa(value)}
                stroke={COLORS.grid}
                strokeWidth="1"
                opacity={value === 0 ? 1 : 0.6}
              />
              <text
                x={M.left - 8}
                y={yCa(value) + 4}
                textAnchor="end"
                fontSize="11"
                fill={COLORS.revenue}
              >
                {formatAxis(value)}
              </text>
              <text
                x={LINE_W - M.right + 8}
                y={yCa(value) + 4}
                textAnchor="start"
                fontSize="11"
                fill={COLORS.orders}
              >
                {formatAxis((maxOrders / 4) * index)}
              </text>
            </g>
          ))}
          {labelled.map((i) => (
            <text
              key={i}
              x={x(i)}
              y={LINE_H - 8}
              textAnchor="middle"
              fontSize="11"
              fill={COLORS.text}
            >
              {formatDay(days[i]?.date ?? '')}
            </text>
          ))}
          {n > 0 && (
            <>
              <path d={area} fill={COLORS.revenue} opacity="0.14" className="chart-fade" />
              <path
                d={caLine}
                fill="none"
                stroke={COLORS.revenue}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
                pathLength={1}
                className="chart-draw"
              />
              <path
                d={ordLine}
                fill="none"
                stroke={COLORS.orders}
                strokeWidth="2"
                strokeDasharray="6 4"
                strokeLinejoin="round"
                className="chart-fade"
              />
            </>
          )}
          {active !== null && current && (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={M.top}
                y2={M.top + plotH}
                stroke={COLORS.ink}
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              <circle
                cx={x(active)}
                cy={yCa(current.chiffreAffaires)}
                r="5"
                fill="#fff"
                stroke={COLORS.revenue}
                strokeWidth="2.5"
              />
              <rect
                x={x(active) - 4.5}
                y={yOrd(current.commandes) - 4.5}
                width="9"
                height="9"
                fill="#fff"
                stroke={COLORS.orders}
                strokeWidth="2"
              />
            </g>
          )}
        </svg>
      </div>

      <p
        role="status"
        aria-live="polite"
        className="tabular min-h-6 text-sm font-semibold text-ink-900"
      >
        {current
          ? t('admin.stats.dayReadout', {
              day: formatDay(current.date),
              revenue: formatMoney(current.chiffreAffaires),
              orders: current.commandes,
              count: current.commandes,
            })
          : focused
            ? t('admin.stats.keyboardHint')
            : ''}
      </p>
    </ChartFigure>
  )
}
