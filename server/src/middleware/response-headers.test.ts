import { describe, expect, test } from 'bun:test'
import { isSensitivePath, withResponseHeaders } from './response-headers'

const allowed = ['https://docs.example.com']

describe('withResponseHeaders', () => {
  test('keeps status and body and adds security and request headers', async () => {
    const original = new Response('{"ok":true}', { status: 201, headers: { 'Content-Type': 'application/json' } })
    const response = withResponseHeaders(original, { requestId: 'req-1', origin: null, allowedOrigins: allowed, sensitive: false })

    expect(response.status).toBe(201)
    expect(await response.text()).toBe('{"ok":true}')
    expect(response.headers.get('Content-Type')).toBe('application/json')
    expect(response.headers.get('X-Request-Id')).toBe('req-1')
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  test('adds the CORS origin only for a listed origin', () => {
    const response = withResponseHeaders(new Response(null), { requestId: 'r', origin: 'https://docs.example.com', allowedOrigins: allowed, sensitive: false })
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://docs.example.com')
  })

  test('merges Vary values instead of overwriting them', () => {
    const original = new Response(null, { headers: { Vary: 'Accept-Language' } })
    const response = withResponseHeaders(original, { requestId: 'r', origin: null, allowedOrigins: allowed, sensitive: false })
    expect(response.headers.get('Vary')).toContain('Accept-Language')
    expect(response.headers.get('Vary')).toContain('Origin')
  })

  test('marks token-bearing responses as not cacheable', () => {
    const response = withResponseHeaders(new Response(null), { requestId: 'r', origin: null, allowedOrigins: allowed, sensitive: true })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})

describe('isSensitivePath', () => {
  test('flags auth, session, and desktop login routes', () => {
    expect(isSensitivePath('/api/auth/login')).toBe(true)
    expect(isSensitivePath('/api/me')).toBe(true)
    expect(isSensitivePath('/api/desktop-login/exchange')).toBe(true)
  })

  test('flags the sync ticket and invitation creation, which return secrets', () => {
    expect(isSensitivePath('/api/sync/events-ticket')).toBe(true)
    expect(isSensitivePath('/api/workspaces/w-1/invites')).toBe(true)
  })

  test('does not flag other workspace routes', () => {
    expect(isSensitivePath('/api/workspaces/w-1')).toBe(false)
    expect(isSensitivePath('/api/workspaces/w-1/sync/pull')).toBe(false)
  })
})
