import { useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useIsFetching, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Button, ChartIcon, EmptyState, ErrorState, RefreshIcon, Skeleton } from '@/components/ui'
import { DonutChart, type DonutSlice } from '@/features/admin/stats/charts/DonutChart'
import { HBarList, type HBarRow } from '@/features/admin/stats/charts/HBarList'
import { LineAreaChart } from '@/features/admin/stats/charts/LineAreaChart'
import { PeakHoursChart } from '@/features/admin/stats/charts/PeakHoursChart'
import { COLORS } from '@/features/admin/stats/charts/chartUtils'
import {
  bestDay,
  busiestHour,
  categoryTotal,
  donutSlices,
  isEmptyPeriod,
  share,
  sum,
} from '@/features/admin/stats/chartMath'
import {
  formatAxisDay,
  formatCalendarDay,
  formatClock,
  formatCompact,
  formatHourLabel,
  formatPercent,
} from '@/features/admin/stats/format'
import { KpiCards } from '@/features/admin/stats/KpiCards'
import { PeriodPicker } from '@/features/admin/stats/PeriodPicker'
import {
  addDays,
  daysIn,
  periodToParams,
  resolvePeriod,
  tunisToday,
  type Period,
} from '@/features/admin/stats/period'
import {
  useBreakdown,
  usePeakHours,
  useSalesByDay,
  useStatsResume,
  useTopArticles,
} from '@/features/admin/stats/api'
import { formatPrice } from '@/lib/format'
import type { Lang, SalesDay, StatutCommande, TypeCommande } from '@/lib/types'
import { useLang } from '@/lib/useLang'

/** Une entrée par jour de la période : les jours sans vente valent 0. */
function fillDays(period: Period, rows: readonly SalesDay[]): SalesDay[] {
  const byDate = new Map(rows.map((r) => [r.date, r]))
  return Array.from({ length: daysIn(period) }, (_, i) => {
    const date = addDays(period.du, i)
    return byDate.get(date) ?? { date, chiffreAffaires: 0, commandes: 0 }
  })
}

const STATUS_ORDER: StatutCommande[] = [
  'EnAttente',
  'EnPreparation',
  'Prete',
  'Terminee',
  'Annulee',
]

const TYPE_STYLE: Record<TypeCommande, Pick<DonutSlice, 'color' | 'pattern'>> = {
  SurPlace: { color: COLORS.olive, pattern: 'solid' },
  ARemporter: { color: COLORS.revenue, pattern: 'stripes' },
  Livraison: { color: COLORS.orders, pattern: 'dots' },
}

/** Section indépendante : squelette aux dimensions du graphique, erreur avec Réessayer, sinon le contenu. */
function Section<T>({
  query,
  aspect,
  children,
}: {
  query: UseQueryResult<T>
  aspect: string
  children: (data: T) => ReactNode
}) {
  const { t } = useTranslation()
  if (query.data !== undefined) return <>{children(query.data)}</>
  if (query.isError) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => void query.refetch()}
        retrying={query.isFetching}
      />
    )
  }
  return (
    <div
      role="status"
      aria-label={t('common.loading')}
      className="flex flex-col gap-3 rounded-lg bg-white p-4 shadow-soft sm:p-5"
    >
      <Skeleton className="h-6 w-1/2" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className={`w-full ${aspect}`} />
    </div>
  )
}

function periodTexts(
  period: Period,
  compare: Period | null,
  lang: Lang,
  t: (k: string, o?: object) => string,
) {
  const [yearDu, yearAu] = [period.du.slice(0, 4), period.au.slice(0, 4)]
  const sameYear = yearDu === yearAu
  const from = formatCalendarDay(period.du, lang, sameYear ? 'short' : 'withYear')
  const to = formatCalendarDay(period.au, lang, 'withYear')
  const label = t('admin.stats.periodLabel', { from, to, count: daysIn(period) })
  const comparedLabel = compare
    ? t('admin.stats.comparedTo', {
        from: formatCalendarDay(
          compare.du,
          lang,
          compare.du.slice(0, 4) === compare.au.slice(0, 4) ? 'short' : 'withYear',
        ),
        to: formatCalendarDay(compare.au, lang, 'short'),
      })
    : ''
  return { label, comparedLabel }
}

export default function AdminDashboard() {
  const { t } = useTranslation()
  const lang = useLang()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const today = tunisToday()
  const { period, invalid } = resolvePeriod(params, today)

  const resume = useStatsResume(period)
  const sales = useSalesByDay(period)
  const top = useTopArticles(period, 10)
  const peak = usePeakHours(period)
  const breakdown = useBreakdown(period)
  const refreshing = useIsFetching({ queryKey: ['private', 'admin', 'stats'] }) > 0

  const setPeriod = (next: Period) => setParams(periodToParams(next), { replace: true })
  const compare = resume.data
    ? { du: resume.data.precedenteDu, au: resume.data.precedenteAu }
    : null
  const texts = periodTexts(period, compare, lang, t as never)
  const empty = isEmptyPeriod(resume.data)

  const money = (v: number) => formatPrice(v, lang)
  const day = (date: string) => formatAxisDay(date, lang)
  const longDay = (date: string) => formatCalendarDay(date, lang, 'short')
  const hour = (h: number) => formatHourLabel(h, lang)

  const days = useMemo(() => (sales.data ? fillDays(period, sales.data) : []), [sales.data, period])

  return (
    <>
      <Seo title={t('admin.nav.dashboard')} noindex />
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section aria-label={t('admin.stats.period')} className="flex flex-col gap-3">
          <PeriodPicker
            key={`${period.du}|${period.au}`}
            period={period}
            today={today}
            invalid={invalid}
            onChange={setPeriod}
          />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="font-semibold" dir="auto">
                {texts.label}
              </p>
              {texts.comparedLabel && <p className="text-sm text-ink-700">{texts.comparedLabel}</p>}
            </div>
            <div className="flex items-center gap-3">
              {resume.dataUpdatedAt > 0 && (
                <p className="tabular text-sm text-ink-500">
                  {t('admin.stats.updatedAt', { time: formatClock(resume.dataUpdatedAt, lang) })}
                </p>
              )}
              <Button
                variant="outline"
                size="sm"
                loading={refreshing}
                icon={<RefreshIcon className="size-4" />}
                onClick={() =>
                  void queryClient.invalidateQueries({ queryKey: ['private', 'admin', 'stats'] })
                }
              >
                {t('admin.stats.refresh')}
              </Button>
            </div>
          </div>
        </section>

        <Section query={resume} aspect="h-48">
          {(data) =>
            empty ? (
              <EmptyState
                icon={<ChartIcon />}
                title={t('admin.stats.emptyTitle')}
                description={t('admin.stats.emptyText')}
              />
            ) : (
              <KpiCards resume={data} />
            )
          }
        </Section>

        {!empty && (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            <div className="lg:col-span-2">
              <Section query={sales} aspect="h-[280px]">
                {() => {
                  const best = bestDay(days)
                  return (
                    <LineAreaChart
                      days={days}
                      title={t('admin.stats.salesTitle')}
                      summary={
                        best
                          ? t('admin.stats.bestDay', {
                              day: longDay(best.date),
                              amount: money(best.chiffreAffaires),
                            })
                          : t('admin.stats.noSales')
                      }
                      formatDay={day}
                      formatMoney={money}
                      formatAxis={(v) => formatCompact(v, lang)}
                    />
                  )
                }}
              </Section>
            </div>

            <Section query={top} aspect="h-72">
              {(rows) => {
                const first = rows[0]
                return (
                  <HBarList
                    title={t('admin.stats.topTitle')}
                    summary={
                      first
                        ? t('admin.stats.topSummary', { name: first.nom, count: first.quantite })
                        : t('admin.stats.noSales')
                    }
                    color={COLORS.orders}
                    rows={rows.map((r, i) => ({
                      key: `${r.articleId ?? 'x'}-${i}`,
                      label: `${i + 1}. ${r.nom}`,
                      value: r.quantite,
                      valueText: t('admin.stats.sold', { count: r.quantite }),
                      sub: money(r.chiffreAffaires),
                    }))}
                    table={{
                      caption: t('admin.stats.topTitle'),
                      headers: [
                        t('admin.stats.article'),
                        t('admin.stats.quantity'),
                        t('admin.stats.revenue'),
                      ],
                      rows: rows.map((r) => [r.nom, r.quantite, money(r.chiffreAffaires)]),
                    }}
                  />
                )
              }}
            </Section>

            <Section query={peak} aspect="h-[230px]">
              {(rows) => {
                const best = busiestHour(rows)
                return (
                  <PeakHoursChart
                    hours={rows}
                    title={t('admin.stats.peakTitle')}
                    summary={
                      best
                        ? t('admin.stats.peakSummary', {
                            hour: hour(best.heure),
                            count: best.commandes,
                          })
                        : t('admin.stats.noSales')
                    }
                    formatHour={hour}
                    formatMoney={money}
                  />
                )
              }}
            </Section>

            <Section query={breakdown} aspect="h-64">
              {(data) => {
                const slices = donutSlices(data.parType)
                const total = sum(data.parType.map((r) => r.commandes))
                const main = [...slices].sort((a, b) => b.percent - a.percent)[0]
                const donut: DonutSlice[] = slices.map((s) => ({
                  key: s.type,
                  label: t(`order.type.${s.type}`),
                  value: s.commandes,
                  percent: s.percent,
                  percentText: formatPercent(s.percent, lang, 0),
                  ...TYPE_STYLE[s.type],
                }))
                return (
                  <DonutChart
                    title={t('admin.stats.typeTitle')}
                    summary={
                      main
                        ? t('admin.stats.typeSummary', {
                            type: t(`order.type.${main.type}`),
                            percent: formatPercent(main.percent, lang, 0),
                          })
                        : t('admin.stats.noSales')
                    }
                    slices={donut}
                    centerValue={String(total)}
                    centerLabel={t('admin.stats.orders')}
                    table={{
                      caption: t('admin.stats.typeTitle'),
                      headers: [
                        t('admin.stats.type'),
                        t('admin.stats.orders'),
                        t('admin.stats.revenue'),
                      ],
                      rows: data.parType.map((r) => [
                        t(`order.type.${r.type}`),
                        r.commandes,
                        money(r.chiffreAffaires),
                      ]),
                    }}
                  />
                )
              }}
            </Section>

            <Section query={breakdown} aspect="h-64">
              {(data) => {
                const rows = [...data.parStatut].sort(
                  (a, b) => STATUS_ORDER.indexOf(a.statut) - STATUS_ORDER.indexOf(b.statut),
                )
                const total = sum(rows.map((r) => r.commandes))
                const bars: HBarRow[] = rows.map((r) => ({
                  key: r.statut,
                  label: t(`order.status.${r.statut}`),
                  value: r.commandes,
                  valueText: `${r.commandes} · ${formatPercent(share(r.commandes, total), lang, 0)}`,
                  sub: money(r.chiffreAffaires),
                }))
                const best = [...rows].sort((a, b) => b.commandes - a.commandes)[0]
                return (
                  <HBarList
                    title={t('admin.stats.statusTitle')}
                    summary={
                      best
                        ? t('admin.stats.statusSummary', {
                            status: t(`order.status.${best.statut}`),
                            count: best.commandes,
                          })
                        : t('admin.stats.noSales')
                    }
                    color={COLORS.gold}
                    rows={bars}
                    table={{
                      caption: t('admin.stats.statusTitle'),
                      headers: [
                        t('admin.stats.status'),
                        t('admin.stats.orders'),
                        t('admin.stats.revenue'),
                      ],
                      rows: rows.map((r) => [
                        t(`order.status.${r.statut}`),
                        r.commandes,
                        money(r.chiffreAffaires),
                      ]),
                    }}
                  />
                )
              }}
            </Section>

            <div className="lg:col-span-2">
              <Section query={breakdown} aspect="h-64">
                {(data) => {
                  // « Autres » (catégorie sans identifiant) toujours en dernier.
                  const rows = [...data.parCategorie].sort(
                    (a, b) =>
                      Number(a.categorieId === null) - Number(b.categorieId === null) ||
                      b.chiffreAffaires - a.chiffreAffaires,
                  )
                  const total = categoryTotal(rows)
                  const first = rows[0]
                  return (
                    <HBarList
                      title={t('admin.stats.categoryTitle')}
                      summary={
                        first
                          ? t('admin.stats.categorySummary', {
                              name: first.nom,
                              amount: money(first.chiffreAffaires),
                            })
                          : t('admin.stats.noSales')
                      }
                      color={COLORS.revenue}
                      rows={rows.map((r, i) => ({
                        key: `${r.categorieId ?? 'autres'}-${i}`,
                        label: r.nom,
                        value: r.chiffreAffaires,
                        valueText: `${money(r.chiffreAffaires)} · ${formatPercent(share(r.chiffreAffaires, total), lang, 0)}`,
                        sub: t('admin.stats.sold', { count: r.quantite }),
                      }))}
                      table={{
                        caption: t('admin.stats.categoryTitle'),
                        headers: [
                          t('admin.stats.category'),
                          t('admin.stats.revenue'),
                          t('admin.stats.quantity'),
                        ],
                        rows: rows.map((r) => [r.nom, money(r.chiffreAffaires), r.quantite]),
                      }}
                    />
                  )
                }}
              </Section>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
