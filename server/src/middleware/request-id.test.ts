import { describe, expect, test } from 'bun:test'
import { resolveRequestId } from './request-id'

describe('resolveRequestId', () => {
  test('keeps a safe incoming id', () => {
    expect(resolveRequestId('abc-123_XYZ')).toBe('abc-123_XYZ')
  })

  test('generates an id when the header is missing', () => {
    expect(resolveRequestId(null)).toMatch(/^[0-9a-f-]{36}$/)
  })

  test('replaces an unsafe or overlong id', () => {
    expect(resolveRequestId('bad id with spaces')).not.toBe('bad id with spaces')
    expect(resolveRequestId('a'.repeat(65))).toMatch(/^[0-9a-f-]{36}$/)
  })
})
