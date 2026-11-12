import { type AppRoute, WORKSPACE_TABS, type WorkspaceTab } from '../models/route.model'

export function readRoute(pathname: string): AppRoute {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'workspaces') return { page: 'workspaces' }
  if (parts[0] === 'settings' && parts[1] === 'mcp') return { page: 'mcp' }
  if (parts[0] === 'admin' && parts[1] === 'mcp') return { page: 'admin-mcp' }
  if (parts[0] === 'admin' && parts[1] === 'workspaces') return { page: 'admin-workspaces' }
  if (parts[0] === 'w' && parts[1]) {
    return { page: 'workspace', workspaceId: parts[1], tab: readTab(parts[2]) }
  }
  return { page: 'overview' }
}

export function routeUrl(route: AppRoute): string {
  if (route.page === 'workspaces') return '/workspaces'
  if (route.page === 'mcp') return '/settings/mcp'
  if (route.page === 'admin-mcp') return '/admin/mcp'
  if (route.page === 'admin-workspaces') return '/admin/workspaces'
  if (route.page === 'workspace') return `/w/${encodeURIComponent(route.workspaceId)}/${route.tab ?? 'overview'}`
  return '/'
}

function readTab(value: string | undefined): WorkspaceTab {
  return WORKSPACE_TABS.find((tab) => tab === value) ?? 'overview'
}
