import { AppError } from './errors/app-error'

export const DEFAULT_PAGE_LIMIT = 100
export const MAX_PAGE_LIMIT = 100

export type CursorKeys = Record<string, string | number>

// Reads the limit query parameter. Anything other than a whole number from 1 to MAX_PAGE_LIMIT is refused.
export function readLimit(url: URL): number {
  const raw = url.searchParams.get('limit')
  if (raw === null) return DEFAULT_PAGE_LIMIT
  if (!/^[1-9]\d*$/.test(raw)) throw new AppError('PAGINATION_INVALID')
  const value = Number(raw)
  if (value > MAX_PAGE_LIMIT) throw new AppError('PAGINATION_INVALID')
  return value
}

// The cursor is opaque to clients. It carries the sort keys of the last row returned.
export function encodeCursor(keys: CursorKeys): string {
  return Buffer.from(JSON.stringify(keys)).toString('base64url')
}

export function decodeCursor(cursor: string | null): CursorKeys | null {
  if (cursor === null) return null
  try {
    const parsed: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed)
      if (entries.every(([, value]) => typeof value === 'string' || typeof value === 'number')) {
        return Object.fromEntries(entries) as CursorKeys
      }
    }
  } catch {
    // Fall through to the error below.
  }
  throw new AppError('PAGINATION_INVALID')
}

// Queries one extra row to learn whether another page exists. That extra row is dropped.
export function pageOf<T>(rows: T[], limit: number, cursorOf: (row: T) => string): { items: T[]; nextCursor: string | null } {
  const items = rows.slice(0, limit)
  const nextCursor = rows.length > limit && items.length > 0 ? cursorOf(items[items.length - 1]) : null
  return { items, nextCursor }
}

// Returns one sort key from a decoded cursor. A cursor from another list is refused, not ignored.
export function cursorText(cursor: CursorKeys | null, key: string): string | null {
  if (cursor === null) return null
  const value = cursor[key]
  if (typeof value !== 'string') throw new AppError('PAGINATION_INVALID')
  return value
}
