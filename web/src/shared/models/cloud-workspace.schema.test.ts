import { describe, expect, test } from 'vitest'
import { apiNodeSchema } from './cloud-workspace.model'

const request = {
  id: 'r1',
  kind: 'request',
  name: 'Create charge',
  method: 'POST',
  url: '/v1/charges',
  body: '{"amount":1200}',
  headers: [{ id: 'h1', name: 'Authorization', value: 'Bearer x', enabled: true }],
  auth: { type: 'bearer', token: 'x' },
  responses: [
    {
      id: 'res1',
      statusCode: '201',
      description: 'Created',
      content: [{ id: 'c1', mediaType: 'application/json', schema: '{}', example: '{}' }],
    },
  ],
}

describe('apiNodeSchema', () => {
  test('accepts a request with its documented fields', () => {
    expect(apiNodeSchema.safeParse(request).success).toBe(true)
  })

  test('accepts a folder whose children are requests', () => {
    expect(apiNodeSchema.safeParse({ id: 'f1', kind: 'folder', name: 'Charges', children: [request] }).success).toBe(true)
  })

  test('refuses a request whose method is not a string', () => {
    expect(apiNodeSchema.safeParse({ ...request, method: 42 }).success).toBe(false)
  })

  test('refuses an invalid child deep inside a folder', () => {
    const tree = { id: 'f1', kind: 'folder', name: 'Charges', children: [{ ...request, responses: [{ id: 'x', statusCode: 201 }] }] }

    expect(apiNodeSchema.safeParse(tree).success).toBe(false)
  })

  test('refuses an unknown auth type', () => {
    expect(apiNodeSchema.safeParse({ ...request, auth: { type: 'oauth' } }).success).toBe(false)
  })

  test('keeps fields the portal does not read', () => {
    const parsed = apiNodeSchema.parse({ ...request, futureField: 'kept' })

    expect(parsed).toMatchObject({ futureField: 'kept' })
  })
})
