import { describe, expect, test } from 'bun:test'
import { AppError } from './app-error'

describe('AppError', () => {
  test('takes its status from the code definition', () => {
    expect(new AppError('WORKSPACE_NOT_FOUND').status).toBe(404)
    expect(new AppError('RATE_LIMITED').status).toBe(429)
  })

  test('renders the message in the requested language', () => {
    const error = new AppError('WORKSPACE_NOT_FOUND')
    expect(error.localizedMessage('en')).toBe('Workspace not found.')
    expect(error.localizedMessage('id')).toBe('Workspace tidak ditemukan.')
  })

  test('passes parameters to a parameterized message', () => {
    const error = new AppError('INVITE_EMAIL_MISMATCH', { params: { email: 'a@b.test' } })
    expect(error.localizedMessage('en')).toContain('a@b.test')
  })

  test('keeps details for validation errors', () => {
    const error = new AppError('WORKSPACE_NAME_INVALID', { details: [{ path: 'name', message: 'too long' }] })
    expect(error.details).toEqual([{ path: 'name', message: 'too long' }])
  })

  test('is an Error so stack and cause are available', () => {
    const error = new AppError('INTERNAL_ERROR', { cause: new Error('db down') })
    expect(error).toBeInstanceOf(Error)
    expect(error.cause).toBeInstanceOf(Error)
  })
})
