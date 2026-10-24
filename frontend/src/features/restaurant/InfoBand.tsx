import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowIcon, ClockIcon, ErrorState, PhoneIcon, PinIcon, Skeleton } from '@/components/ui'
import { formatTime, todayInTunis, weekdayName } from '@/lib/format'
import { useLang } from '@/lib/useLang'
import { useRestaurant } from './api'
import { describeHours } from './hours'
import { OpenStatusBadge } from './OpenStatusBadge'

/** Bandeau « Passez nous voir » : adresse, téléphone, horaires du jour, lien vers /contact. */
export function InfoBand() {
  const { t } = useTranslation()
  const lang = useLang()
  const { data, isPending, isError, error, refetch, isFetching } = useRestaurant()
  const today = todayInTunis()
  const hours = describeHours(data?.horaires.find((h) => h.jourSemaine === today))

  return (
    <section aria-labelledby="info-title" className="bg-sidi-700 text-sand-50">
      <div className="container-page grid gap-8 py-12 md:grid-cols-[1fr_2fr] md:items-center">
        <div>
          <h2 id="info-title" className="text-3xl sm:text-4xl">
            {t('home.info.title')}
          </h2>
          <div className="mt-4">
            <OpenStatusBadge />
          </div>
        </div>

        {isPending && (
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 bg-sand-50/15" />
            ))}
          </div>
        )}

        {isError && (
          <ErrorState
            error={error}
            compact
            title={t('errors.loadFailedTitle')}
            message={t('contact.loadError')}
            onRetry={() => void refetch()}
            retrying={isFetching}
          />
        )}

        {data && (
          <ul className="grid gap-6 sm:grid-cols-3">
            <li className="flex items-start gap-3">
              <PinIcon className="mt-1 size-6 shrink-0 text-gold-400" />
              <div>
                <p className="text-eyebrow text-sand-200">{t('contact.address')}</p>
                <address className="mt-1 not-italic">{data.adresse}</address>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <PhoneIcon className="mt-1 size-6 shrink-0 text-gold-400" />
              <div>
                <p className="text-eyebrow text-sand-200">{t('contact.phone')}</p>
                <a
                  href={`tel:${data.telephone.replace(/\s/g, '')}`}
                  className="mt-1 inline-flex min-h-11 items-center underline-offset-4 hover:underline"
                >
                  <bdi dir="ltr" className="tabular">
                    {data.telephone}
                  </bdi>
                </a>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <ClockIcon className="mt-1 size-6 shrink-0 text-gold-400" />
              <div>
                <p className="text-eyebrow text-sand-200">
                  {t('home.info.today')} · {weekdayName(today, lang)}
                </p>
                <p className="tabular mt-1">
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
                        <span className="block text-sm text-sand-200">
                          {t('restaurant.afterMidnight')}
                        </span>
                      )}
                    </>
                  )}
                </p>
                <Link
                  to="/contact"
                  className="mt-1 inline-flex min-h-11 items-center gap-2 font-semibold underline-offset-4 hover:underline"
                >
                  {t('home.info.allHours')}
                  <ArrowIcon className="size-4" />
                </Link>
              </div>
            </li>
          </ul>
        )}
      </div>
    </section>
  )
}
