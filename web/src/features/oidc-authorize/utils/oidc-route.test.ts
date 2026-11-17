import { describe, expect, test } from 'vitest'
import { isOidcAuthorizeRoute, isOidcLogoutRoute } from '@/features/oidc-authorize/utils/oidc-route'

describe('isOidcAuthorizeRoute', () => {
  test('matches the authorization page only', () => {
    expect(isOidcAuthorizeRoute('/oidc/authorize')).toBe(true)
    expect(isOidcAuthorizeRoute('/oidc/authorizex')).toBe(false)
    expect(isOidcAuthorizeRoute('/oidc/logout')).toBe(false)
    expect(isOidcAuthorizeRoute('/')).toBe(false)
  })
})

describe('isOidcLogoutRoute', () => {
  test('matches the sign-out page only', () => {
    expect(isOidcLogoutRoute('/oidc/logout')).toBe(true)
    expect(isOidcLogoutRoute('/oidc/authorize')).toBe(false)
    expect(isOidcLogoutRoute('/oidc/logout/extra')).toBe(false)
  })
})
