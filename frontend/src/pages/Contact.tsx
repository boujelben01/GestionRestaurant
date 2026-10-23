import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'

/** Placeholder : la page contact arrive à l'étape suivante. */
export default function Contact() {
  const { t } = useTranslation()
  return (
    <section className="container-page py-16">
      <Seo title={t('seo.contactTitle')} description={t('seo.contactDescription')} />
      <h1 className="text-4xl sm:text-5xl">{t('contact.title')}</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-700">{t('contact.subtitle')}</p>
    </section>
  )
}
