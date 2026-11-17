import { describe, expect, test } from 'vitest'
import { isOidcAuthorizeRoute } from '@/features/oidc-authorize/utils/oidc-route'

describe('isOidcAuthorizeRoute', () => {
  test('matches the authorization page only', () => {
    expect(isOidcAuthorizeRoute('/oidc/authorize')).toBe(true)
    expect(isOidcAuthorizeRoute('/oidc/authorizex')).toBe(false)
    expect(isOidcAuthorizeRoute('/oidc/logout')).toBe(false)
    expect(isOidcAuthorizeRoute('/')).toBe(false)
  })
})
