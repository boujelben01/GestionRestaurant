import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/cn'
import { setExplicitLang } from '@/lib/i18n'
import { useLang } from '@/lib/useLang'
import type { Lang } from '@/lib/types'

const OPTIONS: Array<{
  code: Lang
  shortKey: 'lang.frShort' | 'lang.arShort'
  nameKey: 'lang.fr' | 'lang.ar'
}> = [
  { code: 'fr', shortKey: 'lang.frShort', nameKey: 'lang.fr' },
  { code: 'ar', shortKey: 'lang.arShort', nameKey: 'lang.ar' },
]

/**
 * Sélecteur FR / عربي. Chaque libellé porte son propre `lang` et un aria-label
 * dans la langue cible, pour que le lecteur d'écran le prononce correctement.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, i18n } = useTranslation()
  const active = useLang()

  return (
    <div
      role="group"
      aria-label={t('a11y.language')}
      className={cn('inline-flex items-center rounded-full bg-sand-200/80 p-0.5', className)}
    >
      {OPTIONS.map(({ code, shortKey, nameKey }) => {
        const selected = active === code
        return (
          <button
            key={code}
            type="button"
            lang={code}
            dir={code === 'ar' ? 'rtl' : 'ltr'}
            aria-pressed={selected}
            aria-label={i18n.t(nameKey, { lng: code })}
            onClick={() => void setExplicitLang(code)}
            className={cn(
              'min-h-11 min-w-11 rounded-full px-3 text-sm font-semibold transition-colors duration-200',
              selected ? 'bg-ink-900 text-sand-50' : 'text-ink-700 hover:bg-sand-300/60',
            )}
          >
            <span aria-hidden="true">{i18n.t(shortKey, { lng: code })}</span>
          </button>
        )
      })}
    </div>
  )
}
