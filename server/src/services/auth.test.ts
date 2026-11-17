import { describe, expect, test } from 'bun:test'
import { refusesCookieWrite, sessionCookieName } from '@/services/auth'

function cookieWrite(headers: Record<string, string>, method = 'POST') {
  return new Request('http://127.0.0.1:3001/api/workspaces', { method, headers: { Cookie: `${sessionCookieName}=abc`, ...headers } })
}

describe('refusesCookieWrite', () => {
  const trusted = ['http://localhost:5174']

  test('accepts a listed origin and refuses an unlisted one', () => {
    expect(refusesCookieWrite(cookieWrite({ Origin: 'http://localhost:5174', Host: 'api.example' }), trusted)).toBe(false)
    expect(refusesCookieWrite(cookieWrite({ Origin: 'https://evil.example', Host: 'api.example' }), trusted)).toBe(true)
  })

  test('accepts a page whose origin is the host the request was sent to, such as the dev proxy on any port', () => {
    expect(refusesCookieWrite(cookieWrite({ Origin: 'http://127.0.0.1:5180', Host: '127.0.0.1:5180' }), trusted)).toBe(false)
  })

  test('refuses an origin that only shares the host name, or a missing Origin', () => {
    expect(refusesCookieWrite(cookieWrite({ Origin: 'http://127.0.0.1:5180', Host: '127.0.0.1:3001' }), trusted)).toBe(true)
    expect(refusesCookieWrite(cookieWrite({ Origin: 'https://evil.example.attacker', Host: 'evil.example' }), trusted)).toBe(true)
    expect(refusesCookieWrite(cookieWrite({ Host: '127.0.0.1:5180' }), trusted)).toBe(true)
    expect(refusesCookieWrite(cookieWrite({ Origin: 'null', Host: 'null' }), trusted)).toBe(true)
  })
})
