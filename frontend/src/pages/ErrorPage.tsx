import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { AlertIcon, Button, ZelligePattern } from '@/components/ui'

/** Erreur de route / de rendu : « Réessayer » recharge la page, « Accueil » repart de zéro. */
export default function ErrorPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  return (
    <section
      role="alert"
      className="relative isolate flex min-h-[70dvh] flex-1 items-center justify-center overflow-hidden px-4 py-16 text-center"
    >
      <Seo title={t('seo.errorTitle')} noindex />
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.07]" size={72} />
      <div className="max-w-lg">
        <div className="mx-auto mb-6 grid size-16 place-items-center rounded-full bg-white text-3xl text-danger-600 shadow-soft">
          <AlertIcon />
        </div>
        <h1 className="text-3xl sm:text-4xl">{t('errors.page.title')}</h1>
        <p className="mt-3 text-ink-700">{t('errors.page.text')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button onClick={() => window.location.reload()}>{t('common.retry')}</Button>
          <Button variant="outline" onClick={() => void navigate('/')}>
            {t('common.backHome')}
          </Button>
        </div>
      </div>
    </section>
  )
}
