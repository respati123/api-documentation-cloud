import { describe, expect, it } from 'vitest'
import { desktopSignInLink, readDesktopLoginRequest } from './desktop-login.utils'

const valid = '?desktopLoginState=abc&redirect=api-docs%3A%2F%2Fauth%2Ffinish&pk=key'

describe('readDesktopLoginRequest', () => {
  it('returns null without a desktop state', () => {
    expect(readDesktopLoginRequest('?foo=1')).toBeNull()
  })

  it('accepts the registered redirect with a key', () => {
    expect(readDesktopLoginRequest(valid)).toEqual({ state: 'abc', publicKey: 'key', valid: true })
  })

  it('rejects any other redirect', () => {
    expect(readDesktopLoginRequest(valid.replace('api-docs%3A%2F%2Fauth%2Ffinish', 'https%3A%2F%2Fevil.test')).valid).toBe(false)
  })

  it('rejects a request without a key', () => {
    expect(readDesktopLoginRequest('?desktopLoginState=abc&redirect=api-docs%3A%2F%2Fauth%2Ffinish').valid).toBe(false)
  })
})

describe('desktopSignInLink', () => {
  it('builds the custom-scheme link with state and box', () => {
    expect(desktopSignInLink('abc', 'box+1')).toBe('api-docs://auth/finish?state=abc&box=box%2B1')
  })
})
