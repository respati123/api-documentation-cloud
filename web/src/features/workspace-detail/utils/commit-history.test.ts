import { describe, expect, test } from 'vitest'
import { buildChangeTree, buildFileDiffs, diffTotals, groupByDay, shortCommitId } from '@/features/workspace-detail/utils/commit-history'
import { compareSnapshots } from '@/features/workspace-detail/utils/snapshot-diff'
import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'

const request = (id: string, name: string, url: string): RequestNode => ({ id, kind: 'request', name, method: 'GET', url, body: '' })

describe('shortCommitId', () => {
  test('keeps the first seven characters', () => {
    expect(shortCommitId('50640355-6abc')).toBe('5064035')
  })
})

describe('groupByDay', () => {
  test('groups items by local calendar day, newest group first, keeping order inside a day', () => {
    const items = [
      { id: 'c', createdAt: '2026-11-07T15:00:00' },
      { id: 'b', createdAt: '2026-11-07T09:00:00' },
      { id: 'a', createdAt: '2026-11-03T10:00:00' },
    ]

    const groups = groupByDay(items, (item) => item.createdAt)

    expect(groups.map((group) => [group.key, group.items.map((item) => item.id)])).toEqual([
      ['2026-11-07', ['c', 'b']],
      ['2026-11-03', ['a']],
    ])
  })
})

describe('buildFileDiffs', () => {
  const before: ApiNode[] = [
    { id: 'f', kind: 'folder', name: 'Users', children: [request('list', 'List users', '/v1/users'), request('gone', 'Old', '/old')] },
  ]
  const after: ApiNode[] = [
    {
      id: 'f',
      kind: 'folder',
      name: 'Users',
      children: [request('list', 'List users', '/v2/users'), request('new', 'Create user', '/users')],
    },
  ]

  test('gives each changed item its blocks, split rows, and line counts', () => {
    const files = buildFileDiffs(compareSnapshots(before, after))
    const list = files.find((file) => file.id === 'list')

    expect(list?.stats).toEqual({ added: 1, removed: 1 })
    expect(list?.blocks.some((block) => block.kind === 'hunk')).toBe(true)
    expect(list?.blocks.every((block) => Array.isArray(block.splitRows))).toBe(true)
    expect(files.find((file) => file.id === 'new')?.stats.removed).toBe(0)
    expect(files.find((file) => file.id === 'gone')?.stats.added).toBe(0)
  })

  test('sums the counts across items', () => {
    const files = buildFileDiffs(compareSnapshots(before, after))
    const totals = diffTotals(files)

    expect(totals.files).toBe(3)
    expect(totals.added).toBe(files.reduce((sum, file) => sum + file.stats.added, 0))
  })
})

describe('buildChangeTree', () => {
  test('groups changed items by folder path in the order they appear', () => {
    const before: ApiNode[] = [request('root', 'Health', '/health')]
    const after: ApiNode[] = [
      request('root', 'Health', '/healthz'),
      { id: 'f', kind: 'folder', name: 'Billing', children: [request('charge', 'Charge', '/charges')] },
    ]

    const groups = buildChangeTree(buildFileDiffs(compareSnapshots(before, after)))

    expect(groups.map((group) => [group.path, group.files.map((file) => file.id)])).toEqual([
      [[], ['root', 'f']],
      [['Billing'], ['charge']],
    ])
  })
})
