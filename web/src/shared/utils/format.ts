const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY

export function formatDate(value: string, locale: string): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(date)
}

export function formatRelativeDate(value: string, locale: string, now = Date.now()): string | null {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const elapsed = now - date.getTime()
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  if (elapsed < HOUR) return formatter.format(-Math.floor(elapsed / MINUTE), 'minute')
  if (elapsed < DAY) return formatter.format(-Math.floor(elapsed / HOUR), 'hour')
  if (elapsed < WEEK) return formatter.format(-Math.floor(elapsed / DAY), 'day')
  return formatDate(value, locale)
}

// Day and month in the language of the page, for the labels of a chart. The date is read as UTC, so the day does not move.
export function formatShortDate(value: string, locale: string): string {
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date)
}
