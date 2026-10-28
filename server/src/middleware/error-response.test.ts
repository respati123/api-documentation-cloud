import { describe, expect, test } from 'bun:test'
import { AppError } from '@/lib/errors/app-error'
import { errorResponse } from './error-response'

describe('errorResponse', () => {
  test('maps an AppError to its status and the localized shape', async () => {
    const response = errorResponse(new AppError('WORKSPACE_NOT_FOUND'), { requestId: 'req-1', locale: 'id' })
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ code: 'WORKSPACE_NOT_FOUND', error: 'Workspace tidak ditemukan.', details: null, requestId: 'req-1' })
    expect(response.headers.get('Content-Language')).toBe('id')
    expect(response.headers.get('Vary')).toBe('Accept-Language')
  })

  test('includes details only when present', async () => {
    const response = errorResponse(new AppError('WORKSPACE_NAME_INVALID', { details: [{ path: 'name', message: 'too long' }] }), { requestId: 'req-2', locale: 'en' })
    expect((await response.json()).details).toEqual([{ path: 'name', message: 'too long' }])
  })

  test('turns an unknown error into a generic 500 with no internal detail', async () => {
    const response = errorResponse(new Error('connection to 10.0.0.5 refused'), { requestId: 'req-3', locale: 'en' })
    const body = await response.json()
    expect(response.status).toBe(500)
    expect(body).toEqual({ code: 'INTERNAL_ERROR', error: 'Something went wrong. Try again.', details: null, requestId: 'req-3' })
    expect(JSON.stringify(body)).not.toContain('10.0.0.5')
  })
})
