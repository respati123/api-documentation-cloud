import { describe, expect, test } from 'bun:test'
import { routeLabel } from './route-label'

describe('routeLabel', () => {
  test('replaces identifiers with :id so logs group by route', () => {
    expect(routeLabel('/api/workspaces/9f2a-1c')).toBe('/api/workspaces/:id')
    expect(routeLabel('/api/workspaces/w_77/members/u_9')).toBe('/api/workspaces/:id/members/:id')
  })

  test('replaces project, issue, and sprint identifiers too', () => {
    expect(routeLabel('/api/workspaces/w1/projects/p1/issues/PARI-12/checklist/c9')).toBe('/api/workspaces/:id/projects/:id/issues/:id/checklist/:id')
    expect(routeLabel('/api/workspaces/w1/projects/p1/sprints/s1/items/i1')).toBe('/api/workspaces/:id/projects/:id/sprints/:id/items/:id')
  })

  test('leaves fixed routes unchanged', () => {
    expect(routeLabel('/api/auth/login')).toBe('/api/auth/login')
    expect(routeLabel('/health')).toBe('/health')
  })

  test('drops a trailing slash', () => {
    expect(routeLabel('/api/workspaces/')).toBe('/api/workspaces')
  })
})
