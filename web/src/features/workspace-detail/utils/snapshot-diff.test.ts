import { describe, expect, test } from 'vitest'
import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'
import { compareSnapshots } from './snapshot-diff'

const request = (id: string, url: string): RequestNode => ({ id, kind: 'request', name: 'Charges', method: 'GET', url, body: '' })

describe('compareSnapshots', () => {
  test('reports added, modified, and deleted items', () => {
    const before: ApiNode[] = [request('kept', '/a'), request('changed', '/old'), request('removed', '/gone')]
    const after: ApiNode[] = [request('kept', '/a'), request('changed', '/new'), request('added', '/b')]

    const changes = compareSnapshots(before, after)

    expect(changes.map((change) => [change.id, change.kind])).toEqual([
      ['changed', 'modified'],
      ['removed', 'deleted'],
      ['added', 'added'],
    ])
  })

  test('ignores items that did not change', () => {
    const tree: ApiNode[] = [request('same', '/same')]

    expect(compareSnapshots(tree, tree)).toEqual([])
  })

  test('masks credentials in the diff text', () => {
    const before: ApiNode[] = []
    const after: ApiNode[] = [
      { ...request('secure', '/x'), headers: [{ id: 'h', name: 'Authorization', value: 'Bearer abc', enabled: true }] },
    ]

    const [change] = compareSnapshots(before, after)

    expect(change.after).not.toContain('Bearer abc')
  })
})
