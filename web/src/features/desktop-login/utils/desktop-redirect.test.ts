import { describe, expect, test } from 'vitest'
import { isDesktopLoopbackRedirect } from './desktop-redirect'

describe('isDesktopLoopbackRedirect', () => {
  test('accepts the loopback callback the desktop app sends', () => {
    expect(isDesktopLoopbackRedirect('http://127.0.0.1:51234/callback')).toBe(true)
    expect(isDesktopLoopbackRedirect('http://localhost:4000/callback')).toBe(true)
  })

  test('rejects other hosts, paths, schemes, and query strings', () => {
    expect(isDesktopLoopbackRedirect('https://example.com:4000/callback')).toBe(false)
    expect(isDesktopLoopbackRedirect('http://127.0.0.1:4000/other')).toBe(false)
    expect(isDesktopLoopbackRedirect('http://127.0.0.1/callback')).toBe(false)
    expect(isDesktopLoopbackRedirect('http://127.0.0.1:4000/callback?x=1')).toBe(false)
    expect(isDesktopLoopbackRedirect('not a url')).toBe(false)
  })
})
