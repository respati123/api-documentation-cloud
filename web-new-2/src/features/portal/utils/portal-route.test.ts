import { describe, expect, it } from 'vitest'
import type { ApiNode } from '../models/portal.model'
import { findRequestById, readRoute, routeUrl, type PortalRoute } from './portal-route'

const WS = 'w-1'

describe('portal routes', () => {
  it('writes a shareable URL for each section', () => {
    expect(routeUrl({ page: 'directory' })).toBe('/')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'overview' })).toBe('/w/w-1')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'collections' })).toBe('/w/w-1/api/collections')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'history' })).toBe('/w/w-1/api/history')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'design-ui' })).toBe('/w/w-1/design/ui')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'design-database' })).toBe('/w/w-1/design/database')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'projects' })).toBe('/w/w-1/projects')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'team' })).toBe('/w/w-1/team')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'settings' })).toBe('/w/w-1/settings')
    expect(routeUrl({ page: 'account', section: 'mcp-key' })).toBe('/settings/mcp')
    expect(routeUrl({ page: 'account', section: 'admin-mcp-keys' })).toBe('/admin/mcp')
    expect(routeUrl({ page: 'account', section: 'admin-users' })).toBe('/admin/users')
    expect(routeUrl({ page: 'account', section: 'admin-workspaces' })).toBe('/admin/workspaces')
  })

  it('keeps the selected request and the history branch in the URL', () => {
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'collections', requestId: 'r/1' })).toBe('/w/w-1/api/collections/r%2F1')
    expect(routeUrl({ page: 'workspace', workspaceId: WS, tab: 'history', branchId: 'b-2' })).toBe('/w/w-1/api/history?branch=b-2')
  })

  it('reads back every URL it writes', () => {
    const routes: PortalRoute[] = [
      { page: 'directory' },
      { page: 'workspace', workspaceId: WS, tab: 'overview' },
      { page: 'workspace', workspaceId: WS, tab: 'collections' },
      { page: 'workspace', workspaceId: WS, tab: 'collections', requestId: 'req-9' },
      { page: 'workspace', workspaceId: WS, tab: 'history', branchId: 'b-2' },
      { page: 'workspace', workspaceId: WS, tab: 'design-ui' },
      { page: 'workspace', workspaceId: WS, tab: 'design-database' },
      { page: 'workspace', workspaceId: WS, tab: 'projects' },
      { page: 'workspace', workspaceId: WS, tab: 'team' },
      { page: 'workspace', workspaceId: WS, tab: 'settings' },
      { page: 'account', section: 'mcp-key' },
      { page: 'account', section: 'admin-mcp-keys' },
      { page: 'account', section: 'admin-users' },
      { page: 'account', section: 'admin-workspaces' },
    ]
    for (const route of routes) {
      const url = routeUrl(route)
      const [pathname, search = ''] = url.split('?')
      expect(readRoute(pathname, search ? `?${search}` : ''), url).toEqual(route.page === 'directory' ? { page: 'directory' } : route)
    }
  })

  it('reads the workspace directory and unknown paths as the directory', () => {
    expect(readRoute('/workspaces')).toEqual({ page: 'directory' })
    expect(readRoute('/')).toEqual({ page: 'directory' })
    expect(readRoute('/something-else')).toEqual({ page: 'directory' })
  })

  it('opens older links that used the previous names', () => {
    expect(readRoute('/w/w-1/docs')).toEqual({ page: 'workspace', workspaceId: WS, tab: 'collections' })
    expect(readRoute('/w/w-1/activity')).toEqual({ page: 'workspace', workspaceId: WS, tab: 'history' })
    expect(readRoute('/w/w-1/api/collections')).toEqual({ page: 'workspace', workspaceId: WS, tab: 'collections', requestId: undefined })
  })

  it('does not fail on a malformed encoded id', () => {
    expect(readRoute('/w/%E0%A4%A')).toEqual({ page: 'workspace', workspaceId: '%E0%A4%A', tab: 'overview' })
  })

  it('finds a request anywhere in the collection tree', () => {
    const request: ApiNode = { id: 'deep', kind: 'request', name: 'Login', method: 'POST', url: '/login' }
    const tree: ApiNode[] = [{ id: 'f', kind: 'folder', name: 'Auth', children: [{ id: 'g', kind: 'folder', name: 'Sign in', children: [request] }] }]
    expect(findRequestById(tree, 'deep')).toEqual(request)
    expect(findRequestById(tree, 'missing')).toBeNull()
    expect(findRequestById(tree, undefined)).toBeNull()
  })
})
