import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import type { CloudUser } from '@/shared/models/user.model'
import { ApiError } from '@/shared/services/api-client'
import { authService } from '../services/auth.service'
import { useAuthSessionStore } from '../stores/auth-session.store'
import { useAuthSessionViewModel } from './use-auth-session.viewmodel'

vi.mock('../services/auth.service', () => ({
  authService: { currentUser: vi.fn(), logout: vi.fn() },
}))

const user = { id: 'user-1', email: 'owner@example.com' } as CloudUser

let client: QueryClient

function Wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
})

afterEach(() => {
  vi.clearAllMocks()
  useAuthSessionStore.setState({ signedIn: false, userId: '', sessionExpired: false })
})

describe('useAuthSessionViewModel signOut', () => {
  test('returns the screen to anonymous as soon as the session is gone', async () => {
    let serverHasSession = true
    vi.mocked(authService.currentUser).mockImplementation(async () => {
      if (!serverHasSession) throw new ApiError('Session expired', 401)
      return user
    })
    vi.mocked(authService.logout).mockImplementation(async () => {
      serverHasSession = false
    })

    const { result } = renderHook(() => useAuthSessionViewModel(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    await act(() => result.current.signOut())

    await waitFor(() => expect(result.current.status).toBe('anonymous'))
    expect(result.current.user).toBeUndefined()
    expect(authService.logout).toHaveBeenCalledTimes(1)
  })

  test('a sign-out is not reported as an expired session', async () => {
    let serverHasSession = true
    vi.mocked(authService.currentUser).mockImplementation(async () => {
      if (!serverHasSession) throw new ApiError('Session expired', 401)
      return user
    })
    vi.mocked(authService.logout).mockImplementation(async () => {
      serverHasSession = false
    })

    const { result } = renderHook(() => useAuthSessionViewModel(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    await act(() => result.current.signOut())
    await waitFor(() => expect(result.current.status).toBe('anonymous'))

    expect(useAuthSessionStore.getState().sessionExpired).toBe(false)
  })

  test('a refused sign-out keeps the session on screen and reports the error', async () => {
    vi.mocked(authService.currentUser).mockResolvedValue(user)
    vi.mocked(authService.logout).mockRejectedValue(new ApiError('Refused by the server.', 403))

    const { result } = renderHook(() => useAuthSessionViewModel(), { wrapper: Wrapper })
    await waitFor(() => expect(result.current.status).toBe('authenticated'))

    let caught: unknown
    await act(async () => {
      try {
        await result.current.signOut()
      } catch (error) {
        caught = error
      }
    })

    expect(caught).toBeInstanceOf(ApiError)
    expect(result.current.status).toBe('authenticated')
    expect(result.current.user).toEqual(user)
  })
})
