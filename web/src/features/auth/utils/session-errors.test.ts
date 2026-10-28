import { describe, expect, test } from 'vitest'
import { ApiError } from '@/shared/services/api-client'
import { shouldEndSession } from './session-errors'

describe('shouldEndSession', () => {
  test('ends the session on 401', () => {
    expect(shouldEndSession(new ApiError('Sign in is required.', 401, { code: 'AUTH_REQUIRED' }))).toBe(true)
  })

  test('keeps the session on a server error', () => {
    expect(shouldEndSession(new ApiError('Something went wrong.', 500, { code: 'INTERNAL_ERROR' }))).toBe(false)
  })

  test('keeps the session on a network failure', () => {
    expect(shouldEndSession(new TypeError('Failed to fetch'))).toBe(false)
  })
})
