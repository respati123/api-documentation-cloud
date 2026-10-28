import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import i18next from '@/shared/i18n'
import { ApiError, apiCall, apiPage } from './api-client'

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response('{}', { status: 200 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('apiCall', () => {
  test('sends Accept-Language from the active language', async () => {
    await i18next.changeLanguage('id')
    await apiCall('/api/me')

    const init = vi.mocked(fetch).mock.calls[0][1]
    expect(new Headers(init?.headers).get('Accept-Language')).toBe('id')
  })

  test('sends English when English is active', async () => {
    await i18next.changeLanguage('en')
    await apiCall('/api/me')

    const init = vi.mocked(fetch).mock.calls[0][1]
    expect(new Headers(init?.headers).get('Accept-Language')).toBe('en')
  })
})

describe('apiCall errors', () => {
  test('exposes the code, status, request id, and details from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ error: 'Sign in is required.', code: 'AUTH_REQUIRED', requestId: 'req-1' }, { status: 401 })),
    )

    const error = await apiCall('/api/me').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ message: 'Sign in is required.', status: 401, code: 'AUTH_REQUIRED', requestId: 'req-1' })
  })
})

describe('apiCall response envelope', () => {
  test('returns the data field of a success envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ code: 'OK', requestId: 'req-1', data: { workspaces: [] } })),
    )

    await expect(apiCall('/api/workspaces')).resolves.toEqual({ workspaces: [] })
  })

  test('returns undefined data for an empty 204 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(null, { status: 204 })),
    )

    await expect(apiCall('/api/auth/logout', { method: 'POST' })).resolves.toEqual({})
  })
})

describe('apiPage', () => {
  test('returns the page data and the next cursor from meta', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ code: 'OK', requestId: 'req-2', data: { members: [{ id: 'u1' }] }, meta: { nextCursor: 'abc' } })),
    )

    await expect(apiPage<{ members: unknown[] }>('/api/workspaces/w1/members?limit=1')).resolves.toEqual({
      data: { members: [{ id: 'u1' }] },
      nextCursor: 'abc',
    })
  })

  test('returns no cursor on the last page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ code: 'OK', requestId: 'req-3', data: { members: [] }, meta: { nextCursor: null } })),
    )

    await expect(apiPage('/api/workspaces/w1/members')).resolves.toEqual({ data: { members: [] }, nextCursor: null })
  })
})
