import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { formatPrice } from '@/lib/format'
import type { StatsResume, StatsValues } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { formatPercent } from './format'
import {
  VARIATION_ARROW,
  formatVariation,
  variationDirection,
  variationTone,
  type VariationTone,
} from './variation'

interface Kpi {
  key: keyof StatsValues
  labelKey: string
  money: boolean
  higherIsBetter: boolean
}

const KPIS: readonly Kpi[] = [
  {
    key: 'chiffreAffaires',
    labelKey: 'admin.stats.kpi.revenue',
    money: true,
    higherIsBetter: true,
  },
  {
    key: 'nombreCommandes',
    labelKey: 'admin.stats.kpi.orders',
    money: false,
    higherIsBetter: true,
  },
  { key: 'panierMoyen', labelKey: 'admin.stats.kpi.average', money: true, higherIsBetter: true },
  {
    key: 'nombreAnnulees',
    labelKey: 'admin.stats.kpi.cancelled',
    money: false,
    higherIsBetter: false,
  },
  {
    key: 'montantAEncaisser',
    labelKey: 'admin.stats.kpi.toCollect',
    money: true,
    higherIsBetter: false,
  },
  {
    key: 'nouveauxClients',
    labelKey: 'admin.stats.kpi.newCustomers',
    money: false,
    higherIsBetter: true,
  },
]

/** Couleurs de texte AA sur fond blanc : olive 7,9:1, danger 6,4:1, ink-500 6,0:1. */
const TONE: Record<VariationTone, string> = {
  good: 'text-olive-700',
  bad: 'text-danger-600',
  neutral: 'text-ink-500',
}

/** Six indicateurs avec variation : flèche + pourcentage + texte, jamais la couleur seule. */
export function KpiCards({ resume }: { resume: StatsResume }) {
  const { t } = useTranslation()
  const lang = useLang()

  return (
    <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {KPIS.map((kpi) => {
        const raw = resume.periode[kpi.key]
        const value = kpi.money
          ? formatPrice(raw, lang)
          : new Intl.NumberFormat(lang === 'ar' ? 'ar-TN' : 'fr-TN').format(raw)
        const variation = resume.variation[kpi.key]
        const direction = variationDirection(variation)
        const tone = variationTone(variation, kpi.higherIsBetter)
        const label = t(kpi.labelKey)
        const percent =
          variation === null || variation === undefined
            ? ''
            : formatPercent(Math.abs(variation), lang, 1)
        const aria =
          direction === 'none'
            ? t('admin.stats.aria.none', { label, value })
            : t(`admin.stats.aria.${direction}`, { label, value, percent })
        return (
          <li key={kpi.key}>
            <div
              role="group"
              aria-label={aria}
              className="flex h-full flex-col gap-1 rounded-lg bg-white p-4 shadow-soft sm:p-5"
            >
              <p className="text-sm font-semibold text-ink-700" aria-hidden="true">
                {label}
              </p>
              <p
                className="tabular font-display text-3xl font-bold text-ink-900"
                dir="ltr"
                aria-hidden="true"
              >
                {value}
              </p>
              <p
                className={cn('flex items-center gap-1.5 text-sm font-semibold', TONE[tone])}
                aria-hidden="true"
              >
                <span className="text-base leading-none">{VARIATION_ARROW[direction]}</span>
                {direction === 'none' ? (
                  t('admin.stats.noComparison')
                ) : (
                  <>
                    <span dir="ltr" className="tabular">
                      {formatVariation(variation, lang)}
                    </span>
                    <span className="font-normal text-ink-700">{t('admin.stats.vsPrevious')}</span>
                  </>
                )}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
