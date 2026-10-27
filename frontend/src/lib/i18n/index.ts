import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import fr from './locales/fr.json'

/** Le site est en français seul : <html lang dir> reste « fr » / « ltr », même si une autre langue est demandée. */
function applyDocumentLang() {
  document.documentElement.lang = 'fr'
  document.documentElement.dir = 'ltr'
}

void i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr } },
  supportedLngs: ['fr'],
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',
  lng: 'fr',
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  returnNull: false,
})

applyDocumentLang()
i18n.on('languageChanged', applyDocumentLang)

export default i18n
