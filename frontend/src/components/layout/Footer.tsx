import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useRestaurant } from '@/features/restaurant/api'
import { HoursTable } from '@/features/restaurant/HoursTable'
import { cn } from '@/lib/cn'
import {
  Badge,
  ErrorState,
  Logo,
  MailIcon,
  PhoneIcon,
  PinIcon,
  Skeleton,
  ZelligeDivider,
  ZelligePattern,
} from '@/components/ui'
import { NAV_ITEMS } from './nav'

const columnTitle = 'text-eyebrow mb-4 text-gold-400'
const link =
  'inline-flex min-h-11 items-center gap-3 rounded-md text-sand-200 underline-offset-4 transition-colors hover:text-white hover:underline'

function FooterSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-3/4 bg-sand-50/15" />
      <Skeleton className="h-5 w-1/2 bg-sand-50/15" />
      <Skeleton className="h-5 w-2/3 bg-sand-50/15" />
    </div>
  )
}

export function Footer() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch, isFetching } = useRestaurant()
  const name = data?.nom ?? t('brand.name')

  return (
    <footer className="relative isolate mt-24 overflow-hidden bg-ink-900 text-sand-200">
      <ZelligePattern className="-z-10 text-sand-50 opacity-[0.045]" size={80} />
      <div className="container-page pt-12 pb-8">
        <ZelligeDivider className="mb-12 text-gold-400" />

        <div className="grid gap-12 md:grid-cols-[1.1fr_1fr_1fr]">
          <div className="flex flex-col items-start gap-4">
            <Link to="/" aria-label={`${name} — ${t('nav.home')}`} className="rounded-full">
              <Logo textClassName="text-sand-50" />
            </Link>
            <p className="max-w-xs text-sand-300">{t('footer.tagline')}</p>
            {data && (
              <Badge tone={data.ouvertMaintenant ? 'olive' : 'neutral'} dot>
                {data.ouvertMaintenant ? t('restaurant.openNow') : t('restaurant.closedNow')}
              </Badge>
            )}
            <nav aria-label={t('footer.explore')}>
              <ul className="flex flex-wrap gap-x-5">
                {NAV_ITEMS.map((item) => (
                  <li key={item.to}>
                    <Link to={item.to} className={link}>
                      {t(item.key)}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <section aria-labelledby="footer-contact">
            <h2 id="footer-contact" className={columnTitle}>
              {t('footer.contact')}
            </h2>
            {isPending && <FooterSkeleton />}
            {isError && (
              <ErrorState
                compact
                title={t('errors.loadFailedTitle')}
                message={t('footer.contactUnavailable')}
                onRetry={() => void refetch()}
                retrying={isFetching}
              />
            )}
            {data && (
              <ul className="flex flex-col">
                <li>
                  <span className={cn(link, 'items-start py-2 hover:no-underline')}>
                    <PinIcon className="mt-0.5 size-5 shrink-0 text-gold-400" />
                    <address className="not-italic">{data.adresse}</address>
                  </span>
                </li>
                <li>
                  <a href={`tel:${data.telephone.replace(/\s/g, '')}`} className={link}>
                    <PhoneIcon className="size-5 shrink-0 text-gold-400" />
                    <span className="sr-only">{t('a11y.callUs')}: </span>
                    <bdi dir="ltr" className="tabular">
                      {data.telephone}
                    </bdi>
                  </a>
                </li>
                <li>
                  <a href={`mailto:${data.email}`} className={link}>
                    <MailIcon className="size-5 shrink-0 text-gold-400" />
                    <span className="sr-only">{t('a11y.writeToUs')}: </span>
                    <bdi dir="ltr">{data.email}</bdi>
                  </a>
                </li>
              </ul>
            )}
          </section>

          <section aria-labelledby="footer-hours">
            <h2 id="footer-hours" className={columnTitle}>
              {t('footer.hours')}
            </h2>
            {isPending && <FooterSkeleton />}
            {isError && <p className="text-sand-300">{t('footer.hoursUnavailable')}</p>}
            {data && <HoursTable horaires={data.horaires} tone="dark" />}
          </section>
        </div>

        <p className="mt-12 border-t border-sand-50/10 pt-6 text-sm text-sand-300">
          {t('footer.rights', { year: new Date().getFullYear(), name })}
        </p>
      </div>
    </footer>
  )
}
