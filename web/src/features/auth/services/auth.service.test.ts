import { beforeEach, describe, expect, test, vi } from 'vitest'
import { apiCall } from '@/shared/services/api-client'
import { authService } from './auth.service'

vi.mock('@/shared/services/api-client', () => ({
  apiCall: vi.fn(),
}))

const session = { token: 'token-1', user: { id: 'user-1', email: 'owner@example.com' } }

beforeEach(() => {
  vi.mocked(apiCall).mockReset()
})

describe('authService.login', () => {
  test('posts credentials and returns the parsed session', async () => {
    vi.mocked(apiCall).mockResolvedValue(session)

    await expect(authService.login('owner@example.com', 'correct-horse-1')).resolves.toEqual(session)
    expect(apiCall).toHaveBeenCalledWith('/api/auth/login', {
      method: 'POST',
      body: { email: 'owner@example.com', password: 'correct-horse-1' },
    })
  })

  test('rejects a response that does not match the schema', async () => {
    vi.mocked(apiCall).mockResolvedValue({ token: 42 })

    await expect(authService.login('owner@example.com', 'correct-horse-1')).rejects.toThrow()
  })
})

describe('authService.currentUser', () => {
  test('sends the bearer token and returns the user', async () => {
    vi.mocked(apiCall).mockResolvedValue({ user: session.user })

    await expect(authService.currentUser('token-1')).resolves.toEqual(session.user)
    expect(apiCall).toHaveBeenCalledWith('/api/me', { token: 'token-1' })
  })
})

describe('authService.resetPassword', () => {
  test('sends the reset token and new password', async () => {
    vi.mocked(apiCall).mockResolvedValue({})

    await authService.resetPassword('reset-token', 'brand-new-pass-2')
    expect(apiCall).toHaveBeenCalledWith('/api/auth/reset-password', {
      method: 'POST',
      body: { token: 'reset-token', password: 'brand-new-pass-2' },
    })
  })

  test('resolves when the server answers 204 with no body', async () => {
    vi.mocked(apiCall).mockResolvedValue({})

    await expect(authService.resetPassword('reset-token', 'brand-new-pass-2')).resolves.toBeUndefined()
  })
})
