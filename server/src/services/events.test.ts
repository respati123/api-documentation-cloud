import { describe, expect, test } from 'bun:test'
import { isAllowedSyncOrigin, planningScopeOf } from '@/services/events'

const portal = 'https://docs.respati.web.id'

describe('sync socket origins', () => {
  test('the portal origin from PUBLIC_WEB_URL is allowed', () => {
    expect(isAllowedSyncOrigin('https://docs.respati.web.id', portal)).toBe(true)
  })

  test('the portal origin is compared with its scheme, so http is not the same site', () => {
    expect(isAllowedSyncOrigin('http://docs.respati.web.id', portal)).toBe(false)
  })

  test('a trailing slash or path in PUBLIC_WEB_URL does not change the origin that is allowed', () => {
    expect(isAllowedSyncOrigin('https://docs.respati.web.id', 'https://docs.respati.web.id/')).toBe(true)
    expect(isAllowedSyncOrigin('https://docs.respati.web.id', 'https://docs.respati.web.id/app/')).toBe(true)
  })

  test('a host that only starts with the portal name is refused', () => {
    expect(isAllowedSyncOrigin('https://docs.respati.web.id.evil.example', portal)).toBe(false)
    expect(isAllowedSyncOrigin('https://evil.example', portal)).toBe(false)
  })

  test('local development origins stay allowed', () => {
    expect(isAllowedSyncOrigin('http://localhost:5174', portal)).toBe(true)
    expect(isAllowedSyncOrigin('http://127.0.0.1:13100', portal)).toBe(true)
  })

  test('the desktop app origins stay allowed', () => {
    expect(isAllowedSyncOrigin(null, portal)).toBe(true)
    expect(isAllowedSyncOrigin('null', portal)).toBe(true)
    expect(isAllowedSyncOrigin('file://', portal)).toBe(true)
  })

  test('an origin that is not a URL is refused', () => {
    expect(isAllowedSyncOrigin('not a url', portal)).toBe(false)
  })

  test('a local PUBLIC_WEB_URL during development is allowed too', () => {
    expect(isAllowedSyncOrigin('http://localhost:5174', 'http://localhost:5174')).toBe(true)
  })
})

describe('planningScopeOf', () => {
  test.each([
    ['planning/documents', 'documents'],
    ['planning/documents/doc-1/status', 'documents'],
    ['planning/items/item-1', 'items'],
    ['planning/stories/st-1/approve-design', 'items'],
    ['planning/story/st-1/comments', 'comments'],
    ['planning/comments/c-1/resolve', 'comments'],
    ['tasks/t-1', 'tasks'],
    ['tasks/t-1/subtasks', 'tasks'],
    ['projects/p-1/tasks', 'tasks'],
    ['projects/p-1/members', 'members'],
    ['projects/p-1', 'items'],
    ['projects/p-1/issues', 'items'],
    ['projects/p-1/issues/PARI-12/rank', 'items'],
    ['projects/p-1/issues/i-1/checklist/c-1', 'items'],
    ['projects/p-1/sprints/s-1/close', 'items'],
    ['projects/p-1/backlog', 'items'],
    ['projects/p-1/wip-limits/in_progress', 'items'],
    ['projects/p-1/documents/d-1/draft-backlog', 'items'],
    ['projects/p-1/issues/PARI-3/source-reviewed', 'items'],
  ] as const)('%s is %s', (action, scope) => {
    expect(planningScopeOf(action)).toBe(scope)
  })

  test('routes outside project data are not announced', () => {
    expect(planningScopeOf('members/u-1')).toBeNull()
    expect(planningScopeOf('projects')).toBeNull()
  })
})
