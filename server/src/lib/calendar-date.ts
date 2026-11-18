const DAY = 86_400_000
const SHAPE = /^(\d{4})-(\d{2})-(\d{2})$/

// A day written as YYYY-MM-DD that the calendar has. Date.parse rolls 2026-02-30 over to March, so the day is built and compared.
export function isCalendarDate(value: unknown): value is string {
  return calendarDayNumber(value) !== null
}

// The day as a whole number of days since 1970-01-01, or null when it is not a real day.
export function calendarDayNumber(value: unknown): number | null {
  const match = typeof value === 'string' ? SHAPE.exec(value) : null
  if (!match) return null
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const built = new Date(Date.UTC(year, month - 1, day))
  const same = built.getUTCFullYear() === year && built.getUTCMonth() === month - 1 && built.getUTCDate() === day
  return same ? built.getTime() / DAY : null
}
