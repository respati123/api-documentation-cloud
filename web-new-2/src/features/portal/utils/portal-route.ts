import type { ApiNode, WorkspaceSection } from '../models/portal.model'

// The shape of links follows the existing portal, so links shared before this change keep working.
// /                                 workspace directory
// /workspaces                       the same directory
// /w/:id                            workspace overview
// /w/:id/api/collections[/:request] collections, with an optional selected request
// /w/:id/api/history[?branch=:id]   history, with an optional collection branch
// /w/:id/design/ui                  UI · Stitchkit
// /w/:id/design/database            Database · DBDesign
// /w/:id/projects, /team, /settings
// /settings/mcp                     My MCP keys
// /admin/mcp                        MCP key administration
// /admin/users                      user accounts, invitations, and roles
// /admin/workspaces                 every workspace in the app, opened read-only unless a member

export type AccountSection = Extract<WorkspaceSection, 'mcp-key' | 'admin-mcp-keys' | 'admin-users' | 'admin-workspaces'>
export type WorkspacePage = Exclude<WorkspaceSection, AccountSection>

export type PortalRoute =
  | { page: 'directory' }
  | { page: 'account'; section: AccountSection }
  | { page: 'workspace'; workspaceId: string; tab: WorkspacePage; requestId?: string; branchId?: string }

// Links saved before the API section existed still open the matching section.
const LEGACY_TABS: Record<string, WorkspacePage> = { docs: 'collections', activity: 'history' }
const DESIGN_TABS: Record<string, WorkspacePage> = { ui: 'design-ui', database: 'design-database' }
const PAGE_TABS: Record<string, WorkspacePage> = { projects: 'projects', team: 'team', settings: 'settings' }

export function readRoute(pathname: string, search = ''): PortalRoute {
  const parts = pathname.split('/').filter(Boolean).map(safeDecode)
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'workspaces')) return { page: 'directory' }
  if (parts[0] === 'settings' && parts[1] === 'mcp') return { page: 'account', section: 'mcp-key' }
  if (parts[0] === 'admin' && parts[1] === 'mcp') return { page: 'account', section: 'admin-mcp-keys' }
  if (parts[0] === 'admin' && parts[1] === 'users') return { page: 'account', section: 'admin-users' }
  if (parts[0] === 'admin' && parts[1] === 'workspaces') return { page: 'account', section: 'admin-workspaces' }
  if (parts[0] === 'w' && parts[1]) return readWorkspaceRoute(parts[1], parts.slice(2), search)
  return { page: 'directory' }
}

export function routeUrl(route: PortalRoute): string {
  if (route.page === 'directory') return '/'
  if (route.page === 'account') {
    if (route.section === 'mcp-key') return '/settings/mcp'
    if (route.section === 'admin-users') return '/admin/users'
    if (route.section === 'admin-workspaces') return '/admin/workspaces'
    return '/admin/mcp'
  }
  const base = `/w/${encodeURIComponent(route.workspaceId)}`
  if (route.tab === 'overview') return base
  if (route.tab === 'collections') {
    return route.requestId ? `${base}/api/collections/${encodeURIComponent(route.requestId)}` : `${base}/api/collections`
  }
  if (route.tab === 'history') {
    const query = route.branchId ? `?branch=${encodeURIComponent(route.branchId)}` : ''
    return `${base}/api/history${query}`
  }
  if (route.tab === 'design-ui') return `${base}/design/ui`
  if (route.tab === 'design-database') return `${base}/design/database`
  return `${base}/${route.tab}`
}

function readWorkspaceRoute(id: string, rest: string[], search: string): PortalRoute {
  const workspaceId = id
  if (rest.length === 0) return { page: 'workspace', workspaceId, tab: 'overview' }
  if (rest[0] === 'api') {
    if (rest[1] === 'history') {
      const branchId = new URLSearchParams(search).get('branch') ?? undefined
      return { page: 'workspace', workspaceId, tab: 'history', branchId }
    }
    if (rest[1] === 'collections' || rest[1] === undefined || LEGACY_TABS[rest[1]]) {
      const tab = rest[1] && LEGACY_TABS[rest[1]] ? LEGACY_TABS[rest[1]] : 'collections'
      return { page: 'workspace', workspaceId, tab, requestId: rest[2] || undefined }
    }
  }
  if (rest[0] === 'design') return { page: 'workspace', workspaceId, tab: DESIGN_TABS[rest[1] ?? ''] ?? 'design-ui' }
  if (rest[0] && LEGACY_TABS[rest[0]]) return { page: 'workspace', workspaceId, tab: LEGACY_TABS[rest[0]] }
  if (rest[0] && PAGE_TABS[rest[0]]) return { page: 'workspace', workspaceId, tab: PAGE_TABS[rest[0]] }
  return { page: 'workspace', workspaceId, tab: 'overview' }
}

export function findRequestById(nodes: ApiNode[], id: string | undefined): ApiNode | null {
  if (!id) return null
  for (const node of nodes) {
    if (node.id === id) return node
    const inside = findRequestById(node.children ?? [], id)
    if (inside) return inside
  }
  return null
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
