import { describe, expect, test } from 'vitest'
import { readRoute, routeUrl } from '@/features/app-shell/utils/route'

describe('readRoute', () => {
  test('opens the overview at the root path', () => {
    expect(readRoute('/')).toEqual({ page: 'overview' })
  })

  test('opens the workspace list', () => {
    expect(readRoute('/workspaces')).toEqual({ page: 'workspaces' })
  })

  test('opens the MCP key settings', () => {
    expect(readRoute('/settings/mcp')).toEqual({ page: 'mcp' })
    expect(readRoute('/admin/mcp')).toEqual({ page: 'admin-mcp' })
    expect(readRoute('/admin/workspaces')).toEqual({ page: 'admin-workspaces' })
  })

  test('reads the workspace id and tab from a workspace path', () => {
    expect(readRoute('/w/ws-1/team')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'team' })
  })

  test('reads the API sections under /api', () => {
    expect(readRoute('/w/ws-1/api/collections')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'collections' })
    expect(readRoute('/w/ws-1/api/history')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'history' })
    expect(readRoute('/w/ws-1/api')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'collections' })
  })

  test('reads a commit permalink in the history', () => {
    expect(readRoute('/w/ws-1/api/history/c%201')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'history', commitId: 'c 1' })
  })

  test('maps the old docs and activity tabs to the API sections', () => {
    expect(readRoute('/w/ws-1/docs')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'collections' })
    expect(readRoute('/w/ws-1/activity')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'history' })
  })

  test('falls back to the overview tab for a missing or unknown tab', () => {
    expect(readRoute('/w/ws-1')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'overview' })
    expect(readRoute('/w/ws-1/unknown')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'overview' })
  })
})

describe('routeUrl', () => {
  test('builds the workspace path with an encoded id and the tab', () => {
    expect(routeUrl({ page: 'workspace', workspaceId: 'a b', tab: 'team' })).toBe('/w/a%20b/team')
  })

  test('puts the API sections under /api, with the commit in the history path', () => {
    expect(routeUrl({ page: 'workspace', workspaceId: 'ws-1', tab: 'collections' })).toBe('/w/ws-1/api/collections')
    expect(routeUrl({ page: 'workspace', workspaceId: 'ws-1', tab: 'history' })).toBe('/w/ws-1/api/history')
    expect(routeUrl({ page: 'workspace', workspaceId: 'ws-1', tab: 'history', commitId: 'c 1' })).toBe('/w/ws-1/api/history/c%201')
  })

  test('ignores a commit id outside the history', () => {
    expect(routeUrl({ page: 'workspace', workspaceId: 'ws-1', tab: 'team', commitId: 'c1' })).toBe('/w/ws-1/team')
  })

  test('uses the overview tab when a workspace route has no tab', () => {
    expect(routeUrl({ page: 'workspace', workspaceId: 'ws-1' })).toBe('/w/ws-1/overview')
  })

  test('returns the root and list paths for the other pages', () => {
    expect(routeUrl({ page: 'overview' })).toBe('/')
    expect(routeUrl({ page: 'workspaces' })).toBe('/workspaces')
    expect(routeUrl({ page: 'mcp' })).toBe('/settings/mcp')
    expect(routeUrl({ page: 'admin-mcp' })).toBe('/admin/mcp')
    expect(routeUrl({ page: 'admin-workspaces' })).toBe('/admin/workspaces')
  })
})
