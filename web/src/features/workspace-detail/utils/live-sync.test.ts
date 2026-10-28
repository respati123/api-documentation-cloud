import { describe, expect, test } from 'vitest'
import { parseSyncEvent, reconnectDelay, socketUrl } from './live-sync'

describe('parseSyncEvent', () => {
  const event = {
    type: 'workspace.updated',
    workspaceId: 'ws-1',
    headCommitId: 'c-2',
    message: 'Paginate list charges',
    actorId: 'u-1',
    actorEmail: 'ada@test.dev',
    commitCount: 1,
  }

  test('reads a workspace update', () => {
    expect(parseSyncEvent(JSON.stringify(event))).toEqual(event)
  })

  test('reads a change to the team, invitations, settings, or the workspace itself', () => {
    for (const reason of ['members', 'invites', 'settings', 'deleted'] as const) {
      expect(parseSyncEvent(JSON.stringify({ type: 'workspace.changed', workspaceId: 'ws-1', reason }))).toEqual({
        type: 'workspace.changed',
        workspaceId: 'ws-1',
        reason,
      })
    }
  })

  test('refuses a change with an unknown reason', () => {
    expect(parseSyncEvent(JSON.stringify({ type: 'workspace.changed', workspaceId: 'ws-1', reason: 'other' }))).toBeNull()
  })

  test('ignores other event types', () => {
    expect(parseSyncEvent(JSON.stringify({ ...event, type: 'ping' }))).toBeNull()
  })

  test('ignores data that is not JSON', () => {
    expect(parseSyncEvent('not json')).toBeNull()
  })
})

describe('reconnectDelay', () => {
  test('starts at one second and doubles', () => {
    expect(reconnectDelay(0)).toBe(1000)
    expect(reconnectDelay(1)).toBe(2000)
    expect(reconnectDelay(2)).toBe(4000)
  })

  test('never waits longer than 30 seconds', () => {
    expect(reconnectDelay(10)).toBe(30_000)
  })
})

describe('socketUrl', () => {
  test('uses the page origin when no API base is configured', () => {
    expect(socketUrl('', { protocol: 'https:', host: 'docs.example.com' }, 'tok 1')).toBe(
      'wss://docs.example.com/api/sync/events?ticket=tok%201',
    )
  })

  test('uses the API base when one is configured', () => {
    expect(socketUrl('http://localhost:3001', { protocol: 'http:', host: 'localhost:5174' }, 'abc')).toBe(
      'ws://localhost:3001/api/sync/events?ticket=abc',
    )
  })
})
