import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  Badge,
  Button,
  Card,
  ErrorState,
  ExternalIcon,
  Field,
  MailIcon,
  PhoneIcon,
  PinIcon,
  Reveal,
  Skeleton,
  Tooltip,
} from '@/components/ui'
import { useRestaurant } from '@/features/restaurant/api'
import { mapsUrl } from '@/features/restaurant/hours'
import { HoursTable } from '@/features/restaurant/HoursTable'
import { OpenStatusBadge } from '@/features/restaurant/OpenStatusBadge'

const control =
  'block min-h-12 w-full rounded-md border-[1.5px] border-sand-400 bg-white px-4 text-base text-ink-900 disabled:bg-sand-100 disabled:text-ink-500'

/** Formulaire volontairement inactif (pas d'envoi) : champs désactivés + mention « bientôt ». */
function ContactFormPreview() {
  const { t } = useTranslation()
  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">{t('contact.form.title')}</h2>
        <Badge tone="gold">{t('common.comingSoon')}</Badge>
      </div>
      <p className="mt-2 text-ink-700">{t('contact.form.soon')}</p>
      <form className="mt-6 flex flex-col gap-5" noValidate>
        <fieldset disabled className="flex flex-col gap-5">
          <legend className="sr-only">{t('contact.form.title')}</legend>
          <Field label={t('contact.form.name')}>
            {(c) => <input type="text" autoComplete="name" className={control} {...c} />}
          </Field>
          <Field label={t('contact.form.email')}>
            {(c) => (
              <input type="email" autoComplete="email" dir="ltr" className={control} {...c} />
            )}
          </Field>
          <Field label={t('contact.form.message')}>
            {(c) => <textarea rows={5} className={`${control} py-3`} {...c} />}
          </Field>
        </fieldset>
        <Tooltip content={t('contact.form.soon')} placement="top" align="start">
          <Button
            type="button"
            aria-disabled="true"
            size="lg"
            className="pointer-events-auto! cursor-not-allowed"
          >
            {t('contact.form.submit')}
          </Button>
        </Tooltip>
      </form>
    </Card>
  )
}

export default function Contact() {
  const { t } = useTranslation()
  const { data, isPending, isError, refetch, isFetching } = useRestaurant()

  return (
    <>
      <Seo title={t('seo.contactTitle')} description={t('seo.contactDescription')} />
      <PageHeader title={t('contact.title')} subtitle={t('contact.subtitle')}>
        <OpenStatusBadge />
      </PageHeader>

      <div className="container-page grid gap-8 py-12 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <Reveal>
            <Card className="p-6 sm:p-8">
              {isPending && (
                <div className="flex flex-col gap-4">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-6 w-1/2" />
                  <Skeleton className="h-6 w-2/3" />
                </div>
              )}
              {isError && (
                <ErrorState
                  compact
                  title={t('errors.loadFailedTitle')}
                  message={t('contact.loadError')}
                  onRetry={() => void refetch()}
                  retrying={isFetching}
                />
              )}
              {data && (
                <ul className="flex flex-col gap-5">
                  <li className="flex items-start gap-4">
                    <PinIcon className="mt-1 size-6 shrink-0 text-terracotta-600" />
                    <div>
                      <p className="text-eyebrow text-ink-500">{t('contact.address')}</p>
                      <address className="mt-1 not-italic">{data.adresse}</address>
                      <Button
                        href={mapsUrl(data.adresse)}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outline"
                        size="sm"
                        className="mt-3"
                        icon={<ExternalIcon className="size-4" />}
                      >
                        {t('contact.mapLink')}
                        <span className="sr-only"> ({t('a11y.opensInNewTab')})</span>
                      </Button>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <PhoneIcon className="mt-1 size-6 shrink-0 text-terracotta-600" />
                    <div>
                      <p className="text-eyebrow text-ink-500">{t('contact.phone')}</p>
                      <a
                        href={`tel:${data.telephone.replace(/\s/g, '')}`}
                        className="mt-1 inline-flex min-h-11 items-center text-lg font-semibold text-sidi-700 underline underline-offset-4"
                      >
                        <bdi dir="ltr" className="tabular">
                          {data.telephone}
                        </bdi>
                      </a>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <MailIcon className="mt-1 size-6 shrink-0 text-terracotta-600" />
                    <div>
                      <p className="text-eyebrow text-ink-500">{t('contact.email')}</p>
                      <a
                        href={`mailto:${data.email}`}
                        className="mt-1 inline-flex min-h-11 items-center text-lg font-semibold break-all text-sidi-700 underline underline-offset-4"
                      >
                        <bdi dir="ltr">{data.email}</bdi>
                      </a>
                    </div>
                  </li>
                </ul>
              )}
            </Card>
          </Reveal>

          <Reveal delay={0.08}>
            <Card className="p-6 sm:p-8">
              <h2 className="text-2xl">{t('contact.hours')}</h2>
              <div className="mt-4">
                {isPending && <Skeleton className="h-56 w-full" />}
                {isError && <p className="text-ink-700">{t('footer.hoursUnavailable')}</p>}
                {data && <HoursTable horaires={data.horaires} />}
              </div>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={0.16}>
          <ContactFormPreview />
        </Reveal>
      </div>
    </>
  )
}
