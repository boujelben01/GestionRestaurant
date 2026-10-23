import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'

/** Placeholder : le menu public arrive à l'étape suivante. */
export default function Menu() {
  const { t } = useTranslation()
  return (
    <section className="container-page py-16">
      <Seo title={t('seo.menuTitle')} description={t('seo.menuDescription')} />
      <h1 className="text-4xl sm:text-5xl">{t('menu.title')}</h1>
      <p className="mt-3 max-w-xl text-lg text-ink-700">{t('menu.subtitle')}</p>
    </section>
  )
}
