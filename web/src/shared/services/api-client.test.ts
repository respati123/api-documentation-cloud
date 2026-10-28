import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import i18next from '@/shared/i18n'
import { apiCall } from './api-client'

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
