import { beforeEach, describe, expect, test } from 'vitest'
import { useAuthSessionStore } from './auth-session.store'

const user = { id: 'user-1', email: 'owner@example.com' }

beforeEach(() => {
  window.sessionStorage.clear()
  useAuthSessionStore.getState().clearSession()
})

describe('auth session store', () => {
  test('saves the token and user id to session storage', () => {
    useAuthSessionStore.getState().saveSession('token-1', user)

    expect(useAuthSessionStore.getState().token).toBe('token-1')
    expect(useAuthSessionStore.getState().userId).toBe('user-1')
    expect(window.sessionStorage.getItem('api-documentation-cloud-session')).toBe('token-1')
    expect(window.sessionStorage.getItem('api-documentation-cloud-user-id')).toBe('user-1')
  })

  test('clearing the session removes both values', () => {
    useAuthSessionStore.getState().saveSession('token-1', user)
    useAuthSessionStore.getState().clearSession()

    expect(useAuthSessionStore.getState().token).toBe('')
    expect(window.sessionStorage.getItem('api-documentation-cloud-session')).toBeNull()
  })

  test('marks an expired session so the sign-in page can explain it', () => {
    useAuthSessionStore.getState().clearSession({ expired: true })
    expect(useAuthSessionStore.getState().sessionExpired).toBe(true)

    useAuthSessionStore.getState().saveSession('token-2', user)
    expect(useAuthSessionStore.getState().sessionExpired).toBe(false)
  })
})
