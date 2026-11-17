import i18next from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import enActivity from './locales/en/activity.json'
import enAdmin from './locales/en/admin.json'
import enApps from './locales/en/apps.json'
import enAuth from './locales/en/auth.json'
import enCommon from './locales/en/common.json'
import enDesktop from './locales/en/desktop.json'
import enDocs from './locales/en/docs.json'
import enMcp from './locales/en/mcp.json'
import enNotifications from './locales/en/notifications.json'
import enOidc from './locales/en/oidc.json'
import enPlanning from './locales/en/planning.json'
import enProjects from './locales/en/projects.json'
import enSettings from './locales/en/settings.json'
import enShell from './locales/en/shell.json'
import enTeam from './locales/en/team.json'
import enWorkspace from './locales/en/workspace.json'
import enWorkspaces from './locales/en/workspaces.json'
import idActivity from './locales/id/activity.json'
import idAdmin from './locales/id/admin.json'
import idApps from './locales/id/apps.json'
import idAuth from './locales/id/auth.json'
import idCommon from './locales/id/common.json'
import idDesktop from './locales/id/desktop.json'
import idDocs from './locales/id/docs.json'
import idMcp from './locales/id/mcp.json'
import idNotifications from './locales/id/notifications.json'
import idOidc from './locales/id/oidc.json'
import idPlanning from './locales/id/planning.json'
import idProjects from './locales/id/projects.json'
import idSettings from './locales/id/settings.json'
import idShell from './locales/id/shell.json'
import idTeam from './locales/id/team.json'
import idWorkspace from './locales/id/workspace.json'
import idWorkspaces from './locales/id/workspaces.json'

export const languageStorageKey = 'api-documentation-cloud-language'
export const supportedLanguages = ['en', 'id'] as const

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        workspaces: enWorkspaces,
        shell: enShell,
        workspace: enWorkspace,
        docs: enDocs,
        activity: enActivity,
        team: enTeam,
        settings: enSettings,
        desktop: enDesktop,
        projects: enProjects,
        mcp: enMcp,
        planning: enPlanning,
        notifications: enNotifications,
        admin: enAdmin,
        oidc: enOidc,
        apps: enApps,
      },
      id: {
        common: idCommon,
        auth: idAuth,
        workspaces: idWorkspaces,
        shell: idShell,
        workspace: idWorkspace,
        docs: idDocs,
        activity: idActivity,
        team: idTeam,
        settings: idSettings,
        desktop: idDesktop,
        projects: idProjects,
        mcp: idMcp,
        planning: idPlanning,
        notifications: idNotifications,
        admin: idAdmin,
        oidc: idOidc,
        apps: idApps,
      },
    },
    supportedLngs: supportedLanguages,
    load: 'languageOnly',
    fallbackLng: 'en',
    defaultNS: 'common',
    ns: [
      'common',
      'auth',
      'workspaces',
      'shell',
      'workspace',
      'docs',
      'activity',
      'team',
      'settings',
      'desktop',
      'projects',
      'mcp',
      'planning',
      'notifications',
      'admin',
      'oidc',
      'apps',
    ],
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: languageStorageKey,
    },
  })

export default i18next
