import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { formatTime, todayInTunis, weekdayName } from '@/lib/format'
import type { Horaire } from '@/lib/types'
import { useLang } from '@/lib/useLang'
import { orderedWeek } from './hours'

interface HoursTableProps {
  horaires: Horaire[]
  /** `dark` pour un fond encre (footer), `light` sinon. */
  tone?: 'light' | 'dark'
  className?: string
}

/** Horaires des 7 jours (lundi → dimanche), jour courant en évidence, « après minuit » explicite. */
export function HoursTable({ horaires, tone = 'light', className }: HoursTableProps) {
  const { t } = useTranslation()
  const lang = useLang()
  const today = todayInTunis()
  const dark = tone === 'dark'

  return (
    <dl className={cn('flex flex-col text-sm', className)}>
      {orderedWeek(horaires).map(({ day, hours }) => {
        const isToday = day === today
        return (
          <div
            key={day}
            data-today={isToday || undefined}
            className={cn(
              'flex items-baseline justify-between gap-4 border-b py-2.5',
              dark ? 'border-sand-50/10' : 'border-sand-200',
              isToday
                ? dark
                  ? 'font-semibold text-white'
                  : 'font-semibold text-terracotta-700'
                : dark
                  ? 'text-sand-300'
                  : 'text-ink-700',
            )}
          >
            <dt>
              {weekdayName(day, lang)}
              {isToday && <span className="sr-only"> ({t('restaurant.today')})</span>}
            </dt>
            <dd className="tabular text-end">
              {hours.kind === 'closed' ? (
                t('restaurant.closed')
              ) : (
                <>
                  <bdi dir="ltr">
                    {t('restaurant.hoursRange', {
                      open: formatTime(hours.open, lang),
                      close: formatTime(hours.close, lang),
                    })}
                  </bdi>
                  {hours.overnight && (
                    <span className="block text-xs font-normal opacity-90">
                      {t('restaurant.afterMidnight')}
                    </span>
                  )}
                </>
              )}
            </dd>
          </div>
        )
      })}
    </dl>
  )
}
