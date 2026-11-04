import { describe, expect, test } from 'vitest'
import { isDesktopSignInRedirect } from '@/features/desktop-login/utils/desktop-redirect'

describe('isDesktopSignInRedirect', () => {
  test('accepts exactly the desktop sign-in address', () => {
    expect(isDesktopSignInRedirect('api-docs://auth/finish')).toBe(true)
  })

  test('refuses any other address, so a crafted link cannot send a sign-in box elsewhere', () => {
    expect(isDesktopSignInRedirect('api-docs://auth/other')).toBe(false)
    expect(isDesktopSignInRedirect('api-docs://auth/finish?x=1')).toBe(false)
    expect(isDesktopSignInRedirect('api-docs://invite/finish')).toBe(false)
    expect(isDesktopSignInRedirect('https://evil.example/finish')).toBe(false)
    expect(isDesktopSignInRedirect('http://127.0.0.1:38459/callback')).toBe(false)
    expect(isDesktopSignInRedirect('not a url')).toBe(false)
  })
})
