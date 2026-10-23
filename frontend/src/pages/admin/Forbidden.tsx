import { useTranslation } from 'react-i18next'
import { Seo } from '@/components/Seo'
import { Button, Logo, ZelligePattern } from '@/components/ui'

/** Page 403 : compte connecté sans le rôle d'administrateur. */
export default function Forbidden() {
  const { t } = useTranslation()
  return (
    <section className="relative isolate flex min-h-dvh flex-1 flex-col items-center justify-center gap-6 overflow-hidden px-4 py-16 text-center">
      <Seo title={t('admin.forbidden.title')} noindex />
      <ZelligePattern className="-z-10 text-terracotta-600 opacity-[0.07]" size={72} />
      <Logo />
      <p
        aria-hidden="true"
        dir="ltr"
        className="font-display text-[6rem] leading-none font-bold text-terracotta-600"
      >
        403
      </p>
      <h1 className="text-3xl sm:text-4xl">{t('admin.forbidden.title')}</h1>
      <p className="max-w-md text-ink-700">{t('admin.forbidden.text')}</p>
      <Button to="/">{t('common.backHome')}</Button>
    </section>
  )
}
