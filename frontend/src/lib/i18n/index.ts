import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import type { Lang } from '@/lib/types'
import ar from './locales/ar.json'
import fr from './locales/fr.json'

export const SUPPORTED_LANGS: readonly Lang[] = ['fr', 'ar']
export const LANG_STORAGE_KEY = 'resto.lang'

export function normalizeLang(value: string | undefined | null): Lang {
  return value?.toLowerCase().startsWith('ar') ? 'ar' : 'fr'
}

export const dirOf = (lang: Lang) => (lang === 'ar' ? 'rtl' : 'ltr')

/** Met à jour <html lang dir> : appelé à l'init et à chaque changement de langue. */
export function applyDocumentLang(lang: Lang) {
  document.documentElement.lang = lang
  document.documentElement.dir = dirOf(lang)
}

/** Vrai si l'utilisateur a déjà choisi une langue lui-même (sélecteur ou profil). */
export function hasExplicitLang(): boolean {
  try {
    return localStorage.getItem(LANG_STORAGE_KEY) !== null
  } catch {
    return false
  }
}

/** Change la langue ET la mémorise comme choix explicite. */
export function setExplicitLang(lang: Lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang)
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
  return i18n.changeLanguage(lang)
}

/** À la connexion : applique langueFavorite seulement si aucune langue n'a été choisie. */
export function applyFavoriteLang(favorite: string | undefined | null) {
  if (!favorite || hasExplicitLang()) return
  const lang = normalizeLang(favorite)
  if (lang !== currentLang()) void i18n.changeLanguage(lang)
}

/** Langue active, toujours « fr » ou « ar » (utilisée pour ?lang= côté API). */
export function currentLang(): Lang {
  return normalizeLang(i18n.resolvedLanguage ?? i18n.language)
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, ar: { translation: ar } },
    supportedLngs: SUPPORTED_LANGS as unknown as string[],
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    detection: {
      // localStorage d'abord, puis la langue du navigateur.
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANG_STORAGE_KEY,
      // On n'écrit PAS la langue détectée : seul un choix explicite (setExplicitLang) est mémorisé,
      // ce qui permet d'appliquer la langue favorite du profil à la connexion.
      caches: [],
    },
    returnNull: false,
  })

applyDocumentLang(currentLang())
i18n.on('languageChanged', (lng) => applyDocumentLang(normalizeLang(lng)))

export default i18n
