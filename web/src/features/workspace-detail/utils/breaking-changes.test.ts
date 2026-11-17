import { describe, expect, test } from 'vitest'
import { detectBreakingChanges } from '@/features/workspace-detail/utils/breaking-changes'
import type { ApiNode, RequestNode } from '@/shared/models/cloud-workspace.model'

const request = (overrides: Partial<RequestNode> = {}): RequestNode => ({
  id: 'r',
  kind: 'request',
  name: 'Get user',
  method: 'GET',
  url: '{{baseUrl}}/users/:id',
  body: '',
  ...overrides,
})

const withExample = (statusCode: string, example: unknown): Partial<RequestNode> => ({
  responses: [
    {
      id: `resp-${statusCode}`,
      statusCode,
      description: '',
      content: [{ id: 'c', mediaType: 'application/json', schema: '', example: JSON.stringify(example) }],
    },
  ],
})

const reasons = (before: ApiNode[], after: ApiNode[]) =>
  detectBreakingChanges(before, after).map((change) => [change.nodeId, change.reason])

describe('detectBreakingChanges', () => {
  test('flags a removed endpoint, also inside a removed folder', () => {
    const before: ApiNode[] = [{ id: 'f', kind: 'folder', name: 'Users', children: [request()] }]

    expect(reasons(before, [])).toEqual([['r', 'endpoint-removed']])
  })

  test('flags a changed method', () => {
    expect(reasons([request()], [request({ method: 'POST' })])).toEqual([['r', 'method-changed']])
  })

  test('flags a changed path but not a changed query string', () => {
    expect(reasons([request()], [request({ url: '{{baseUrl}}/v2/users/:id' })])).toEqual([['r', 'path-changed']])
    expect(reasons([request()], [request({ url: '{{baseUrl}}/users/:id?expand=team' })])).toEqual([])
  })

  test('flags a documented response status that was removed', () => {
    const before = [
      request({
        ...withExample('200', {}),
        responses: [...(withExample('200', {}).responses ?? []), ...(withExample('404', {}).responses ?? [])],
      }),
    ]
    const after = [request(withExample('200', {}))]

    expect(detectBreakingChanges(before, after)).toMatchObject([{ reason: 'response-removed', detail: '404' }])
  })

  test('flags fields removed from a response example, including nested and array items', () => {
    const before = [request(withExample('200', { id: 1, name: 'Ada', team: { id: 2, slug: 'core' }, tags: [{ label: 'x' }] }))]
    const after = [request(withExample('200', { id: 1, team: { id: 2 }, tags: [{}] }))]

    expect(detectBreakingChanges(before, after).map((change) => change.detail)).toEqual(['200 name', '200 team.slug', '200 tags[].label'])
  })

  test('does not flag added endpoints, added fields, or edits to text', () => {
    const before = [request(withExample('200', { id: 1 }))]
    const after = [
      request({ ...withExample('200', { id: 1, email: 'a@b.c' }), name: 'Fetch user', documentation: 'Reads one user.' }),
      request({ id: 'new', url: '/new' }),
    ]

    expect(detectBreakingChanges(before, after)).toEqual([])
  })

  test('ignores examples that are not JSON', () => {
    const before = [
      request({
        responses: [
          { id: 'x', statusCode: '200', description: '', content: [{ id: 'c', mediaType: 'text/plain', schema: '', example: 'ok' }] },
        ],
      }),
    ]
    const after = [
      request({
        responses: [
          { id: 'x', statusCode: '200', description: '', content: [{ id: 'c', mediaType: 'text/plain', schema: '', example: 'fine' }] },
        ],
      }),
    ]

    expect(detectBreakingChanges(before, after)).toEqual([])
  })
})
