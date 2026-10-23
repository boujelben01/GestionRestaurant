import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'

/** Placeholder : la page d'accueil riche arrive à l'étape suivante. */
export default function Home() {
  const { t } = useTranslation()
  return (
    <section className="container-page py-16">
      <Seo title={t('seo.homeTitle')} description={t('seo.homeDescription')} />
      <p className="text-eyebrow text-terracotta-700">{t('home.eyebrow')}</p>
      <h1 className="mt-3 max-w-2xl text-4xl sm:text-6xl">{t('home.title')}</h1>
      <p className="mt-4 max-w-xl text-lg text-ink-700">{t('home.subtitle')}</p>
    </section>
  )
}
