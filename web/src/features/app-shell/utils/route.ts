import { type AppRoute, WORKSPACE_TABS, type WorkspaceTab } from '../models/route.model'

export function readRoute(pathname: string): AppRoute {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] === 'workspaces') return { page: 'workspaces' }
  if (parts[0] === 'w' && parts[1]) {
    return { page: 'workspace', workspaceId: parts[1], tab: readTab(parts[2]) }
  }
  return { page: 'overview' }
}

export function routeUrl(route: AppRoute): string {
  if (route.page === 'workspaces') return '/workspaces'
  if (route.page === 'workspace') return `/w/${encodeURIComponent(route.workspaceId)}/${route.tab ?? 'overview'}`
  return '/'
}

function readTab(value: string | undefined): WorkspaceTab {
  return WORKSPACE_TABS.find((tab) => tab === value) ?? 'overview'
}
