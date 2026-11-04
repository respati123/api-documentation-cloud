import { afterEach, describe, expect, test, vi } from 'vitest'
import { apiCall } from '@/shared/services/api-client'

afterEach(() => vi.unstubAllGlobals())

describe('api client', () => {
  test('sends the session cookie with every request, so the browser holds no token', async () => {
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify({ code: 'OK', data: {} }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await apiCall('/api/me')

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.credentials).toBe('include')
  })
})
