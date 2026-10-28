import { describe, expect, test } from 'vitest'
import { isSensitiveName, MASKED_VALUE, redactText } from './redact'

describe('isSensitiveName', () => {
  test('flags names that look like credentials', () => {
    expect(isSensitiveName('Authorization')).toBe(true)
    expect(isSensitiveName('x-api_key')).toBe(true)
    expect(isSensitiveName('password')).toBe(true)
  })

  test('leaves ordinary names alone', () => {
    expect(isSensitiveName('limit')).toBe(false)
  })
})

describe('redactText', () => {
  test('masks sensitive keys in JSON and keeps the rest', () => {
    const input = JSON.stringify({ name: 'Ada', token: 'abc', nested: [{ secret: 'x', id: 1 }] })
    const output = JSON.parse(redactText(input)) as Record<string, unknown>

    expect(output.name).toBe('Ada')
    expect(output.token).toBe(MASKED_VALUE)
    expect(output.nested).toEqual([{ secret: MASKED_VALUE, id: 1 }])
  })

  test('masks credential assignments in text that is not JSON', () => {
    expect(redactText('password=hunter2 limit=10')).toBe(`password=${MASKED_VALUE} limit=10`)
  })
})
