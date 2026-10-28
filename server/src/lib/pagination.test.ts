import { describe, expect, test } from 'bun:test'
import { AppError } from './errors/app-error'
import { cursorText, cursorValues, DEFAULT_PAGE_LIMIT, decodeCursor, encodeCursor, pageOf, readLimit } from './pagination'

const url = (query: string) => new URL(`https://api.test/api/workspaces${query}`)

describe('readLimit', () => {
  test('uses the default page size when limit is missing', () => {
    expect(readLimit(url(''))).toBe(DEFAULT_PAGE_LIMIT)
  })

  test('accepts a limit from 1 to 100', () => {
    expect(readLimit(url('?limit=1'))).toBe(1)
    expect(readLimit(url('?limit=100'))).toBe(100)
  })

  test.each(['0', '-5', '101', 'abc', '1.5', ''])('rejects limit=%s', (value) => {
    expect(() => readLimit(url(`?limit=${value}`))).toThrow(AppError)
  })
})

describe('cursor', () => {
  test('round-trips the sort keys', () => {
    const cursor = encodeCursor({ t: '2026-10-28 10:01:11.664123+00', i: 'abc' })
    expect(decodeCursor(cursor)).toEqual({ t: '2026-10-28 10:01:11.664123+00', i: 'abc' })
  })

  test('returns null when there is no cursor', () => {
    expect(decodeCursor(null)).toBeNull()
  })

  test('rejects a cursor that is not valid base64url JSON', () => {
    expect(() => decodeCursor('not-a-cursor')).toThrow(AppError)
  })
})

describe('pageOf', () => {
  test('returns the first page and a cursor for the last item when more rows exist', () => {
    const rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    const page = pageOf(rows, 2, (row) => encodeCursor({ i: row.id }))

    expect(page.items).toEqual([{ id: 'a' }, { id: 'b' }])
    expect(decodeCursor(page.nextCursor)).toEqual({ i: 'b' })
  })

  test('returns no cursor on the last page', () => {
    const page = pageOf([{ id: 'a' }], 2, (row) => encodeCursor({ i: row.id }))

    expect(page.items).toEqual([{ id: 'a' }])
    expect(page.nextCursor).toBeNull()
  })
})

describe('cursorText', () => {
  test('returns null when there is no cursor', () => {
    expect(cursorText(null, 't')).toBeNull()
  })

  test('returns the stored key', () => {
    expect(cursorText({ t: 'x', i: 'y' }, 'i')).toBe('y')
  })

  test('refuses a cursor from another list that lacks the key', () => {
    expect(() => cursorText({ i: 'y' }, 't')).toThrow(AppError)
  })
})

describe('cursorValues', () => {
  test('returns null when there is no cursor', () => {
    expect(cursorValues(null, ['t', 'i'])).toBeNull()
  })

  test('returns the named keys of a cursor', () => {
    expect(cursorValues({ r: '1', t: 'at', i: 'id' }, ['r', 't', 'i'])).toEqual({ r: '1', t: 'at', i: 'id' })
  })

  test('refuses a cursor from another list that lacks one of the keys', () => {
    expect(() => cursorValues({ t: 'at' }, ['t', 'i'])).toThrow(AppError)
  })
})
