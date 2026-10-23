import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { ArrowIcon, Button, ZelligeDivider, ZelligePattern } from '@/components/ui'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <section className="relative isolate flex flex-1 items-center justify-center overflow-hidden px-4 py-16 text-center">
      <Seo title={t('seo.notFoundTitle')} noindex />
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.07]" size={72} />
      <div className="max-w-lg">
        <p
          aria-hidden="true"
          dir="ltr"
          className="font-display text-[7rem] leading-none font-bold tracking-tight text-terracotta-600 sm:text-[9rem]"
        >
          4<span className="text-gold-400">0</span>4
        </p>
        <ZelligeDivider className="mx-auto my-6 max-w-xs" />
        <h1 className="text-3xl sm:text-4xl">{t('errors.notFound.title')}</h1>
        <p className="mt-3 text-ink-700">{t('errors.notFound.text')}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button to="/">{t('common.backHome')}</Button>
          <Button to="/menu" variant="outline" icon={<ArrowIcon />}>
            {t('common.seeMenu')}
          </Button>
        </div>
      </div>
    </section>
  )
}
