import { useTranslation } from 'react-i18next'
import { dirOf, normalizeLang } from '@/lib/i18n'
import type { Lang } from '@/lib/types'

/** Langue active (« fr » | « ar »), réactive au changement de langue. */
export function useLang(): Lang {
  const { i18n } = useTranslation()
  return normalizeLang(i18n.resolvedLanguage ?? i18n.language)
}

export function useDir(): 'ltr' | 'rtl' {
  return dirOf(useLang())
}
