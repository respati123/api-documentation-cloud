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
