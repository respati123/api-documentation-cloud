import { describe, expect, test } from 'bun:test'
import { routeLabel } from './route-label'

describe('routeLabel', () => {
  test('replaces identifiers with :id so logs group by route', () => {
    expect(routeLabel('/api/workspaces/9f2a-1c')).toBe('/api/workspaces/:id')
    expect(routeLabel('/api/workspaces/w_77/members/u_9')).toBe('/api/workspaces/:id/members/:id')
  })

  test('leaves fixed routes unchanged', () => {
    expect(routeLabel('/api/auth/login')).toBe('/api/auth/login')
    expect(routeLabel('/health')).toBe('/health')
  })

  test('drops a trailing slash', () => {
    expect(routeLabel('/api/workspaces/')).toBe('/api/workspaces')
  })
})
