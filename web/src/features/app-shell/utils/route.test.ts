import { describe, expect, test } from 'vitest'
import { readRoute, routeUrl } from './route'

describe('readRoute', () => {
  test('opens the overview at the root path', () => {
    expect(readRoute('/')).toEqual({ page: 'overview' })
  })

  test('opens the workspace list', () => {
    expect(readRoute('/workspaces')).toEqual({ page: 'workspaces' })
  })

  test('reads the workspace id and tab from a workspace path', () => {
    expect(readRoute('/w/ws-1/docs')).toEqual({ page: 'workspace', workspaceId: 'ws-1', tab: 'docs' })
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

  test('uses the overview tab when a workspace route has no tab', () => {
    expect(routeUrl({ page: 'workspace', workspaceId: 'ws-1' })).toBe('/w/ws-1/overview')
  })

  test('returns the root and list paths for the other pages', () => {
    expect(routeUrl({ page: 'overview' })).toBe('/')
    expect(routeUrl({ page: 'workspaces' })).toBe('/workspaces')
  })
})
