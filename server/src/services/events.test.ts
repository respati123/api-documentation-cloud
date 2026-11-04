import { describe, expect, test } from 'bun:test'
import { isAllowedSyncOrigin } from '@/services/events'

const portal = 'https://docs.respati.web.id'

describe('sync socket origins', () => {
  test('the portal origin from PUBLIC_WEB_URL is allowed', () => {
    expect(isAllowedSyncOrigin('https://docs.respati.web.id', portal)).toBe(true)
  })

  test('the portal origin is compared with its scheme, so http is not the same site', () => {
    expect(isAllowedSyncOrigin('http://docs.respati.web.id', portal)).toBe(false)
  })

  test('a trailing slash or path in PUBLIC_WEB_URL does not change the origin that is allowed', () => {
    expect(isAllowedSyncOrigin('https://docs.respati.web.id', 'https://docs.respati.web.id/')).toBe(true)
    expect(isAllowedSyncOrigin('https://docs.respati.web.id', 'https://docs.respati.web.id/app/')).toBe(true)
  })

  test('a host that only starts with the portal name is refused', () => {
    expect(isAllowedSyncOrigin('https://docs.respati.web.id.evil.example', portal)).toBe(false)
    expect(isAllowedSyncOrigin('https://evil.example', portal)).toBe(false)
  })

  test('local development origins stay allowed', () => {
    expect(isAllowedSyncOrigin('http://localhost:5174', portal)).toBe(true)
    expect(isAllowedSyncOrigin('http://127.0.0.1:13100', portal)).toBe(true)
  })

  test('the desktop app origins stay allowed', () => {
    expect(isAllowedSyncOrigin(null, portal)).toBe(true)
    expect(isAllowedSyncOrigin('null', portal)).toBe(true)
    expect(isAllowedSyncOrigin('file://', portal)).toBe(true)
  })

  test('an origin that is not a URL is refused', () => {
    expect(isAllowedSyncOrigin('not a url', portal)).toBe(false)
  })

  test('a local PUBLIC_WEB_URL during development is allowed too', () => {
    expect(isAllowedSyncOrigin('http://localhost:5174', 'http://localhost:5174')).toBe(true)
  })
})
