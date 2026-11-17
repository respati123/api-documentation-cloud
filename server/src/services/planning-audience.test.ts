import { describe, expect, test } from 'bun:test'
import type { AppContext } from '@/context'
import { broadcastPlanningChange } from '@/services/events'
import { audienceFromAction } from '@/services/planning-audience'

describe('audienceFromAction', () => {
  test.each([
    ['planning/documents', { kind: 'managers' }],
    ['planning/documents/upload', { kind: 'managers' }],
    ['planning/documents/doc-1/status', { kind: 'document', id: 'doc-1' }],
    ['planning/items', { kind: 'managers' }],
    ['planning/task-drafts/t-1', { kind: 'managers' }],
    ['planning/items/st-1/publish', { kind: 'item', id: 'st-1' }],
    ['planning/stories/st-1/approve-design', { kind: 'item', id: 'st-1' }],
    ['planning/story/st-1/comments', { kind: 'item', id: 'st-1' }],
    ['planning/task/t-1/comments', { kind: 'task-thread', id: 't-1' }],
    ['planning/document/doc-1/comments', { kind: 'document', id: 'doc-1' }],
    ['planning/comments/c-1/resolve', { kind: 'comment', id: 'c-1' }],
    ['tasks/t-1/subtasks', { kind: 'everyone' }],
    ['projects/p-1/tasks', { kind: 'everyone' }],
    ['projects/p-1/members', { kind: 'everyone' }],
  ] as const)('%s', (action, target) => {
    expect(audienceFromAction(action)).toEqual(target)
  })

  test('routes outside project data have no audience', () => {
    expect(audienceFromAction('members/u-1')).toBeNull()
  })
})

describe('broadcastPlanningChange', () => {
  test('only sockets of people in the audience receive the event', () => {
    const sent: string[] = []
    const socket = (userId: string) => ({ data: { userId }, send: () => sent.push(userId) })
    const ctx = { syncSockets: new Set([socket('reader'), socket('outsider'), socket('reader')]) } as unknown as AppContext

    broadcastPlanningChange(ctx, 'ws-1', 'items', 'actor', ['reader'])

    expect(sent).toEqual(['reader', 'reader'])
  })
})
