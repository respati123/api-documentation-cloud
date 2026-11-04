import { beforeEach, describe, expect, test } from 'vitest'
import { useAuthSessionStore } from './auth-session.store'

const user = { id: 'user-1', email: 'owner@example.com' }

beforeEach(() => {
  window.sessionStorage.clear()
  useAuthSessionStore.getState().clearSession()
})

describe('auth session store', () => {
  test('saving the user marks the session signed in, and keeps no token on the page', () => {
    useAuthSessionStore.getState().saveSession(user)

    expect(useAuthSessionStore.getState().signedIn).toBe(true)
    expect(useAuthSessionStore.getState().userId).toBe('user-1')
    expect(useAuthSessionStore.getState().token).toBe('')
    expect(window.sessionStorage.getItem('api-documentation-cloud-session')).toBeNull()
  })

  test('clearing the session signs out and clears the user id', () => {
    useAuthSessionStore.getState().saveSession(user)
    useAuthSessionStore.getState().clearSession()

    expect(useAuthSessionStore.getState().signedIn).toBe(false)
    expect(useAuthSessionStore.getState().userId).toBe('')
  })

  test('marks an expired session so the sign-in page can explain it', () => {
    useAuthSessionStore.getState().clearSession({ expired: true })
    expect(useAuthSessionStore.getState().sessionExpired).toBe(true)

    useAuthSessionStore.getState().saveSession(user)
    expect(useAuthSessionStore.getState().sessionExpired).toBe(false)
  })
})
