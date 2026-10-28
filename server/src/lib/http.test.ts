import { describe, expect, test } from 'bun:test'
import { created, noContent, ok } from './http'

describe('response builders', () => {
  test('ok returns 200 with the payload as JSON', async () => {
    const response = ok({ workspace: { id: 'w-1' } })
    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')
    expect(await response.json()).toEqual({ workspace: { id: 'w-1' } })
  })

  test('created returns 201 with the payload as JSON', async () => {
    const response = created({ workspace: { id: 'w-2' } })
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ workspace: { id: 'w-2' } })
  })

  test('noContent returns 204 with no body and no content type', async () => {
    const response = noContent()
    expect(response.status).toBe(204)
    expect(response.headers.get('Content-Type')).toBeNull()
    expect(await response.text()).toBe('')
  })
})
