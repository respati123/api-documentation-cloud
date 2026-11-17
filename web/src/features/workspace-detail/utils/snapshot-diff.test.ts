import { describe, expect, test } from 'vitest'
import { compareSnapshots } from '@/features/workspace-detail/utils/snapshot-diff'
import type { ApiNode, KeyValueRow, RequestNode } from '@/shared/models/cloud-workspace.model'

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

describe('compareSnapshots output', () => {
  test('leaves out row ids and extra fields, so reordering keys or new ids is not a change', () => {
    const before: ApiNode[] = [{ ...request('r', '/x'), headers: [{ id: 'h-1', name: 'Accept', value: 'json', enabled: true }] }]
    const after: ApiNode[] = [
      {
        ...request('r', '/x'),
        headers: [{ enabled: true, value: 'json', name: 'Accept', id: 'h-2', extra: 'ignored' } as unknown as KeyValueRow],
      },
    ]

    expect(compareSnapshots(before, after)).toEqual([])
  })

  test('treats a reformatted JSON body with the same content as unchanged', () => {
    const before: ApiNode[] = [{ ...request('r', '/x'), body: '{"a":1,"b":[1,2]}' }]
    const after: ApiNode[] = [{ ...request('r', '/x'), body: '{\n    "a": 1,\n    "b": [1, 2]\n}' }]

    expect(compareSnapshots(before, after)).toEqual([])
  })

  test('includes path params, form fields, and GraphQL variables', () => {
    const before: ApiNode[] = [request('r', '/users/:id')]
    const after: ApiNode[] = [
      {
        ...request('r', '/users/:id'),
        pathParams: [{ id: 'p', name: 'id', value: '7', enabled: true }],
        bodyFields: [{ id: 'f', name: 'avatar', value: '', enabled: true, type: 'file', fileName: 'me.png' }],
        bodyVariables: '{"first":10}',
      },
    ]

    const [change] = compareSnapshots(before, after)

    expect(change.after).toContain('"pathParams"')
    expect(change.after).toContain('"avatar"')
    expect(change.after).toContain('"first": 10')
  })

  test('names the method, folder path, and URL of a changed request', () => {
    const before: ApiNode[] = [{ id: 'f', kind: 'folder', name: 'Billing', children: [request('r', '/old')] }]
    const after: ApiNode[] = [{ id: 'f', kind: 'folder', name: 'Billing', children: [request('r', '/new')] }]

    const [change] = compareSnapshots(before, after)

    expect(change).toMatchObject({ method: 'GET', name: 'Charges', path: ['Billing'], url: '/new', nodeKind: 'request' })
  })
})

test('shows a JSON body one field per line, not as one escaped string', () => {
  const [change] = compareSnapshots([], [{ ...request('r', '/x'), body: '{"name":"Ada","age":36}' }])

  expect(change.after).toContain('"name": "Ada"')
  expect(change.after).not.toContain('\\"name\\"')
})
