import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import en from './locales/en/portal.json'
import id from './locales/id/portal.json'

export const LANGUAGE_STORAGE_KEY = 'api-documentation.language'
export const supportedLanguages = ['en', 'id'] as const
export type AppLanguage = (typeof supportedLanguages)[number]

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { portal: en },
      id: { portal: id },
    },
    supportedLngs: supportedLanguages,
    load: 'languageOnly',
    fallbackLng: 'en',
    defaultNS: 'portal',
    ns: ['portal'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    },
  })

i18next.on('languageChanged', language => {
  document.documentElement.lang = language
})

export default i18next
