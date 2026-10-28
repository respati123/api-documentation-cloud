import { describe, expect, test } from 'vitest'
import { formatDate, formatRelativeDate } from './format'

describe('formatDate', () => {
  test('formats a valid timestamp with the active language', () => {
    expect(formatDate('2026-10-28T00:00:00Z', 'en')).toContain('2026')
  })

  test('returns null for an invalid timestamp', () => {
    expect(formatDate('not a date', 'en')).toBeNull()
  })
})

describe('formatRelativeDate', () => {
  test('describes a recent time in words', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000).toISOString()

    expect(formatRelativeDate(twoHoursAgo, 'en')).toBe('2 hours ago')
  })

  test('uses the minute unit for a time a few minutes ago', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60_000).toISOString()

    expect(formatRelativeDate(fiveMinutesAgo, 'en')).toBe('5 minutes ago')
  })

  test('falls back to the absolute date after a week', () => {
    const twoWeeksAgo = new Date(Date.now() - 14 * 86_400_000).toISOString()

    expect(formatRelativeDate(twoWeeksAgo, 'en')).toBe(formatDate(twoWeeksAgo, 'en'))
  })

  test('returns null for an invalid timestamp', () => {
    expect(formatRelativeDate('nope', 'en')).toBeNull()
  })
})
