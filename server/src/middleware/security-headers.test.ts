import { describe, expect, test } from 'bun:test'
import { securityHeaders } from './security-headers'

describe('securityHeaders', () => {
  test('sets the baseline headers and the request id', () => {
    const headers = securityHeaders({ requestId: 'req-1', sensitive: false })
    expect(headers.get('X-Content-Type-Options')).toBe('nosniff')
    expect(headers.get('Referrer-Policy')).toBe('no-referrer')
    expect(headers.get('X-Request-Id')).toBe('req-1')
    expect(headers.get('Cache-Control')).toBeNull()
  })

  test('marks token-bearing responses as not cacheable', () => {
    expect(securityHeaders({ requestId: 'req-2', sensitive: true }).get('Cache-Control')).toBe('no-store')
  })
})
