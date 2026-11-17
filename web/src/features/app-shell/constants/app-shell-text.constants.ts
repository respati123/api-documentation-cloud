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
    expandMenu: 'shell:nav.expandMenu',
    collapseMenu: 'shell:nav.collapseMenu',
    searchWorkspaces: 'shell:nav.searchWorkspaces',
    workspaceMenuLabel: 'shell:nav.workspaceMenuLabel',
    workspaceOverview: 'shell:nav.workspaceOverview',
    api: 'shell:nav.api',
    collections: 'shell:nav.collections',
    history: 'shell:nav.history',
    projects: 'shell:nav.projects',
    team: 'shell:nav.team',
    settings: 'shell:nav.settings',
    toggleApi: 'shell:nav.toggleApi',
  },
  switcher: {
    label: 'shell:switcher.label',
    placeholder: 'shell:switcher.placeholder',
    yourWorkspaces: 'shell:switcher.yourWorkspaces',
    allWorkspaces: 'shell:switcher.allWorkspaces',
    createWorkspace: 'shell:switcher.createWorkspace',
    empty: 'shell:switcher.empty',
    loadMore: 'shell:switcher.loadMore',
  },
  account: {
    signOut: 'shell:account.signOut',
    signOutFailed: 'shell:account.signOutFailed',
    settings: 'shell:account.settings',
    mcp: 'shell:account.mcp',
    admin: 'shell:account.admin',
    adminMcp: 'shell:account.adminMcp',
    adminWorkspaces: 'shell:account.adminWorkspaces',
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
    mcp: 'shell:page.mcp',
    adminMcp: 'shell:page.adminMcp',
    adminWorkspaces: 'shell:page.adminWorkspaces',
  },
  session: {
    checking: 'shell:session.checking',
  },
  notice: {
    dismiss: 'shell:notice.dismiss',
  },
  context: {
    title: 'shell:context.title',
    subtitle: 'shell:context.subtitle',
    workspaces: 'shell:context.workspaces',
    workspacesDetail: 'shell:context.workspacesDetail',
    recentWorkspaces: 'shell:context.recentWorkspaces',
    quickLinks: 'shell:context.quickLinks',
    connection: 'shell:context.connection',
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
  mcp: SHELL_TEXT.page.mcp,
  'admin-mcp': SHELL_TEXT.page.adminMcp,
  'admin-workspaces': SHELL_TEXT.page.adminWorkspaces,
}

export const WORKSPACE_TAB_TEXT: Record<WorkspaceTab, string> = {
  overview: 'workspace:tabs.overview',
  collections: 'workspace:tabs.collections',
  history: 'workspace:tabs.history',
  projects: 'workspace:tabs.projects',
  team: 'workspace:tabs.team',
  settings: 'workspace:tabs.settings',
}
