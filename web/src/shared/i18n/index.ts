import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enWorkspaces from './locales/en/workspaces.json'
import idAuth from './locales/id/auth.json'
import idCommon from './locales/id/common.json'
import idWorkspaces from './locales/id/workspaces.json'

export const languageStorageKey = 'api-documentation-cloud-language'
export const supportedLanguages = ['en', 'id'] as const

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, auth: enAuth, workspaces: enWorkspaces },
      id: { common: idCommon, auth: idAuth, workspaces: idWorkspaces },
    },
    supportedLngs: supportedLanguages,
    load: 'languageOnly',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: ['common', 'auth', 'workspaces'],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: languageStorageKey,
    },
  })

export default i18next
