import { describe, expect, test } from 'bun:test'
import { created, noContent, ok } from './http'
import { runWithRequestId } from './request-context'

const run = <T>(fn: () => T) => runWithRequestId('req-42', async () => fn())

describe('response builders', () => {
  test('ok wraps the payload in the response base with code OK', async () => {
    const response = await run(() => ok({ workspace: { id: 'w-1' } }))
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual({ code: 'OK', requestId: 'req-42', data: { workspace: { id: 'w-1' } } })
  })

  test('created wraps the payload with code CREATED and status 201', async () => {
    const response = await run(() => created({ workspace: { id: 'w-2' } }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ code: 'CREATED', requestId: 'req-42', data: { workspace: { id: 'w-2' } } })
  })

  test('noContent returns 204 with no body and no content type', async () => {
    const response = noContent()
    expect(response.status).toBe(204)
    expect(response.headers.get('Content-Type')).toBeNull()
    expect(await response.text()).toBe('')
  })
})
