import type { AppRoute, WorkspaceTab } from '../models/route.model'

export const SHELL_TEXT = {
  brand: {
    name: 'shell:brand.name',
    subtitle: 'shell:brand.subtitle',
  },
  nav: {
    mainLabel: 'shell:nav.mainLabel',
    groupWorkspace: 'shell:nav.groupWorkspace',
    overview: 'shell:nav.overview',
    workspaces: 'shell:nav.workspaces',
    yourWorkspaces: 'shell:nav.yourWorkspaces',
    emptyWorkspaces: 'shell:nav.emptyWorkspaces',
    createWorkspace: 'shell:nav.createWorkspace',
    closeMenu: 'shell:nav.closeMenu',
    menu: 'shell:nav.menu',
    version: 'shell:nav.version',
  },
  account: {
    signOut: 'shell:account.signOut',
  },
  breadcrumb: {
    root: 'shell:breadcrumb.root',
  },
  api: {
    checking: 'shell:api.checking',
    connected: 'shell:api.connected',
    unavailable: 'shell:api.unavailable',
  },
  page: {
    overview: 'shell:page.overview',
    workspaces: 'shell:page.workspaces',
    workspace: 'shell:page.workspace',
  },
  session: {
    checking: 'shell:session.checking',
  },
  notice: {
    dismiss: 'shell:notice.dismiss',
  },
  unavailable: {
    title: 'shell:unavailable.title',
    detail: 'shell:unavailable.detail',
    back: 'shell:unavailable.back',
  },
} as const

export const SHELL_PAGE_TITLE: Record<AppRoute['page'], string> = {
  overview: SHELL_TEXT.page.overview,
  workspaces: SHELL_TEXT.page.workspaces,
  workspace: SHELL_TEXT.page.workspace,
}

export const WORKSPACE_TAB_TEXT: Record<WorkspaceTab, string> = {
  overview: 'workspace:tabs.overview',
  docs: 'workspace:tabs.docs',
  activity: 'workspace:tabs.activity',
  team: 'workspace:tabs.team',
  settings: 'workspace:tabs.settings',
}
