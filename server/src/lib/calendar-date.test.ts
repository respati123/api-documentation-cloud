import { describe, expect, test } from 'bun:test'
import { calendarDayNumber, isCalendarDate } from '@/lib/calendar-date'

describe('isCalendarDate', () => {
  test('accepts a real day, including the last day of a month and a leap day', () => {
    for (const day of ['2026-07-15', '2026-04-30', '2028-02-29', '2026-12-31']) expect(isCalendarDate(day)).toBe(true)
  })

  test('refuses a day the month does not have, which a plain date parse would roll over', () => {
    for (const day of ['2026-02-30', '2026-04-31', '2027-02-29', '2026-00-10', '2026-13-01', '2026-01-00']) expect(isCalendarDate(day)).toBe(false)
  })

  test('refuses anything that is not written as year, month, day', () => {
    for (const day of ['2026-7-5', '15/07/2026', '2026-07-15T00:00:00Z', ' 2026-07-15', '', 'tomorrow']) expect(isCalendarDate(day)).toBe(false)
    for (const value of [null, undefined, 20260715, {}]) expect(isCalendarDate(value)).toBe(false)
  })
})

describe('calendarDayNumber', () => {
  test('counts whole days, so two dates give the days between them', () => {
    expect((calendarDayNumber('2026-07-15') as number) - (calendarDayNumber('2026-07-01') as number)).toBe(14)
    expect((calendarDayNumber('2026-03-01') as number) - (calendarDayNumber('2026-02-28') as number)).toBe(1)
  })

  test('is null for a date that does not exist', () => {
    expect(calendarDayNumber('2026-02-30')).toBeNull()
  })
})
