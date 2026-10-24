import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { PeakHour } from '@/lib/types'
import { busiestHour, niceMax, ticks } from '../chartMath'
import { COLORS, useChartWidth, useCursor } from './chartUtils'
import { ChartFigure } from './shared'

const H = 230
const M = { left: 40, right: 8, top: 26, bottom: 28 }

interface PeakHoursChartProps {
  hours: readonly PeakHour[]
  title: string
  summary: string
  formatHour: (hour: number) => string
  formatMoney: (value: number) => string
}

/** 24 barres (heure locale de Tunis) ; la plus chargée est en terracotta et étiquetée « Pointe à 20 h ». */
export function PeakHoursChart({
  hours,
  title,
  summary,
  formatHour,
  formatMoney,
}: PeakHoursChartProps) {
  const { t } = useTranslation()
  const svgRef = useRef<SVGSVGElement>(null)
  const { ref: boxRef, width: W } = useChartWidth()
  const { active, setActive, onKeyDown } = useCursor(24)
  const [focused, setFocused] = useState(false)

  // Une entrée par heure, même si l'API en omettait.
  const byHour = Array.from(
    { length: 24 },
    (_, h) => hours.find((x) => x.heure === h) ?? { heure: h, commandes: 0, chiffreAffaires: 0 },
  )
  const peak = busiestHour(byHour)
  const max = niceMax(Math.max(0, ...byHour.map((h) => h.commandes)))
  const plotW = W - M.left - M.right
  const plotH = H - M.top - M.bottom
  const slot = plotW / 24
  const barW = slot * 0.66
  const yOf = (v: number) => M.top + plotH - (v / max) * plotH

  const onMove = (clientX: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const px = ((clientX - rect.left) / rect.width) * W
    setActive(Math.max(0, Math.min(23, Math.floor((px - M.left) / slot))))
  }
  const current = active !== null ? byHour[active] : undefined

  return (
    <ChartFigure
      title={title}
      summary={summary}
      table={{
        caption: title,
        headers: [t('admin.stats.hour'), t('admin.stats.orders'), t('admin.stats.revenue')],
        rows: byHour.map((h) => [formatHour(h.heure), h.commandes, formatMoney(h.chiffreAffaires)]),
      }}
    >
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
          viewBox={`0 0 ${W} ${H}`}
          role="img"
          aria-label={summary}
          width={W}
          height={H}
          className="block w-full"
          onMouseMove={(event) => onMove(event.clientX)}
          onMouseLeave={() => setActive(null)}
        >
          {ticks(max, 4).map((value) => (
            <g key={value}>
              <line
                x1={M.left}
                x2={W - M.right}
                y1={yOf(value)}
                y2={yOf(value)}
                stroke={COLORS.grid}
                strokeWidth="1"
                opacity={value === 0 ? 1 : 0.6}
              />
              <text
                x={M.left - 6}
                y={yOf(value) + 4}
                textAnchor="end"
                fontSize="11"
                fill={COLORS.text}
              >
                {value}
              </text>
            </g>
          ))}
          {byHour.map((h) => {
            const isPeak = peak?.heure === h.heure
            const x = M.left + slot * h.heure + (slot - barW) / 2
            const top = yOf(h.commandes)
            return (
              <g key={h.heure}>
                {h.commandes > 0 && (
                  <rect
                    x={x}
                    y={top}
                    width={barW}
                    height={M.top + plotH - top}
                    rx="2"
                    fill={isPeak ? COLORS.revenue : COLORS.orders}
                    stroke={active === h.heure ? COLORS.ink : 'none'}
                    strokeWidth="2"
                    className="chart-grow-y"
                  />
                )}
                {h.heure % 3 === 0 && (
                  <text
                    x={x + barW / 2}
                    y={H - 9}
                    textAnchor="middle"
                    fontSize="11"
                    fill={COLORS.text}
                  >
                    {h.heure}
                  </text>
                )}
              </g>
            )
          })}
          {peak && (
            <text
              x={Math.min(W - 70, Math.max(M.left + 60, M.left + slot * peak.heure + slot / 2))}
              y={Math.max(14, yOf(peak.commandes) - 8)}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill={COLORS.revenue}
            >
              {t('admin.stats.peakAt', { hour: formatHour(peak.heure) })}
            </text>
          )}
        </svg>
      </div>
      <p role="status" aria-live="polite" className="tabular min-h-6 text-sm font-semibold">
        {current
          ? t('admin.stats.hourReadout', {
              hour: formatHour(current.heure),
              orders: current.commandes,
              count: current.commandes,
              revenue: formatMoney(current.chiffreAffaires),
            })
          : focused
            ? t('admin.stats.keyboardHint')
            : ''}
      </p>
    </ChartFigure>
  )
}
