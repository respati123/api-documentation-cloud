import {
  API_TABS,
  type ApiTab,
  type AppRoute,
  DESIGN_TABS,
  type DesignTab,
  WORKSPACE_TABS,
  type WorkspaceTab,
} from '@/features/app-shell/models/route.model'

// Links saved before the API section existed still open the matching section.
const LEGACY_TABS: Record<string, WorkspaceTab> = { docs: 'collections', activity: 'history' }

export function readRoute(pathname: string): AppRoute {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'workspaces') return { page: 'workspaces' }
  if (parts[0] === 'settings' && parts[1] === 'mcp') return { page: 'mcp' }
  if (parts[0] === 'admin' && parts[1] === 'mcp') return { page: 'admin-mcp' }
  if (parts[0] === 'admin' && parts[1] === 'workspaces') return { page: 'admin-workspaces' }
  if (parts[0] === 'admin' && parts[1] === 'users') return { page: 'admin-users' }
  if (parts[0] === 'w' && parts[1]) return readWorkspaceRoute(parts[1], parts.slice(2))
  return { page: 'overview' }
}

export function routeUrl(route: AppRoute): string {
  if (route.page === 'workspaces') return '/workspaces'
  if (route.page === 'mcp') return '/settings/mcp'
  if (route.page === 'admin-mcp') return '/admin/mcp'
  if (route.page === 'admin-workspaces') return '/admin/workspaces'
  if (route.page === 'admin-users') return '/admin/users'
  if (route.page === 'workspace') {
    const base = `/w/${encodeURIComponent(route.workspaceId)}`
    const tab = route.tab ?? 'overview'
    if (tab === 'history' && route.commitId) return `${base}/api/history/${encodeURIComponent(route.commitId)}`
    if (isDesignTab(tab)) return `${base}/design/${tab.replace('design-', '')}`
    return isApiTab(tab) ? `${base}/api/${tab}` : `${base}/${tab}`
  }
  return '/'
}

export function isApiTab(tab: WorkspaceTab): tab is ApiTab {
  return API_TABS.some((item) => item === tab)
}

export function isDesignTab(tab: WorkspaceTab): tab is DesignTab {
  return DESIGN_TABS.some((item) => item === tab)
}

function readWorkspaceRoute(id: string, rest: string[]): AppRoute {
  const workspaceId = decodeURIComponent(id)
  if (rest[0] === 'design')
    return { page: 'workspace', workspaceId, tab: DESIGN_TABS.find((item) => item === `design-${rest[1]}`) ?? 'design-ui' }
  if (rest[0] === 'api') {
    const tab = API_TABS.find((item) => item === rest[1]) ?? 'collections'
    if (tab === 'history' && rest[2]) return { page: 'workspace', workspaceId, tab, commitId: decodeURIComponent(rest[2]) }
    return { page: 'workspace', workspaceId, tab }
  }
  return { page: 'workspace', workspaceId, tab: readTab(rest[0]) }
}

function readTab(value: string | undefined): WorkspaceTab {
  if (value && LEGACY_TABS[value]) return LEGACY_TABS[value]
  return WORKSPACE_TABS.find((tab) => tab === value) ?? 'overview'
}
