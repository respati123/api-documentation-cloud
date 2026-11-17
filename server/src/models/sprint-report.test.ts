import { describe, expect, test } from 'bun:test'
import { burndown, type ScopeEvent, type StatusEvent } from '@/models/sprint-report'

const at = (day: string, time = '12:00:00') => new Date(`${day}T${time}Z`)
const scope = (issueId: string, action: ScopeEvent['action'], day: string, pointsAfter: number | null, afterStart = false): ScopeEvent => ({ issueId, action, pointsAfter, afterStart, at: at(day) })
const status = (issueId: string, toStatus: string, day: string): StatusEvent => ({ issueId, toStatus, at: at(day) })

// A sprint from the 1st to the 5th. Two items are committed when it starts, 5 points and 3 points.
const base = { startsOn: '2026-07-01', endsOn: '2026-07-05', startedAt: at('2026-07-01', '08:00:00'), closedAt: null as Date | null }
const committed = [scope('a', 'committed', '2026-07-01', 5), scope('b', 'committed', '2026-07-01', 3)]

describe('burndown', () => {
  test('starts at the committed points and counts down as items are done', () => {
    const result = burndown({ ...base, scope: committed, status: [status('a', 'done', '2026-07-02'), status('b', 'done', '2026-07-04')], today: at('2026-07-05') })
    expect(result.total).toBe(8)
    expect(result.days.map((day) => day.remaining)).toEqual([8, 3, 3, 0, 0])
  })

  test('the ideal line runs from the committed points to zero on the last day', () => {
    const result = burndown({ ...base, scope: committed, status: [], today: at('2026-07-05') })
    expect(result.days.map((day) => day.ideal)).toEqual([8, 6, 4, 2, 0])
    expect(result.days.map((day) => day.date)).toEqual(['2026-07-01', '2026-07-02', '2026-07-03', '2026-07-04', '2026-07-05'])
  })

  test('days that have not come yet have no remaining value', () => {
    const result = burndown({ ...base, scope: committed, status: [], today: at('2026-07-03') })
    expect(result.days.map((day) => day.remaining)).toEqual([8, 8, 8, null, null])
  })

  test('an item added after the start raises the remaining points, and one removed lowers them', () => {
    const events = [...committed, scope('c', 'added', '2026-07-02', 2, true), scope('a', 'removed', '2026-07-03', 5, true)]
    const result = burndown({ ...base, scope: events, status: [], today: at('2026-07-04') })
    expect(result.days.map((day) => day.remaining)).toEqual([8, 10, 5, 5, null])
    expect(result.total).toBe(8)
  })

  test('a new estimate changes the remaining points from that day on', () => {
    const events = [...committed, { issueId: 'a', action: 'points_changed' as const, pointsAfter: 8, afterStart: true, at: at('2026-07-03') }]
    const result = burndown({ ...base, scope: events, status: [], today: at('2026-07-04') })
    expect(result.days.map((day) => day.remaining)).toEqual([8, 8, 11, 11, null])
  })

  test('an item that is done and then reopened counts again', () => {
    const result = burndown({ ...base, scope: committed, status: [status('a', 'done', '2026-07-02'), status('a', 'in_progress', '2026-07-03')], today: at('2026-07-04') })
    expect(result.days.map((day) => day.remaining)).toEqual([8, 3, 8, 8, null])
  })

  test('an item carried over to the next sprint leaves this one', () => {
    const events = [...committed, scope('b', 'carried_over', '2026-07-05', 3, true)]
    const result = burndown({ ...base, scope: events, status: [], closedAt: at('2026-07-05', '18:00:00'), today: at('2026-07-09') })
    expect(result.days.map((day) => day.remaining)).toEqual([8, 8, 8, 8, 5])
  })

  test('a closed sprint stops at the day it was closed', () => {
    const result = burndown({ ...base, scope: committed, status: [], closedAt: at('2026-07-03', '18:00:00'), today: at('2026-07-09') })
    expect(result.days.map((day) => day.remaining)).toEqual([8, 8, 8, null, null])
  })

  test('a sprint nobody started has no baseline and no remaining values', () => {
    const result = burndown({ ...base, startedAt: null, scope: [scope('a', 'added', '2026-06-28', 5)], status: [], today: at('2026-06-30') })
    expect(result.total).toBe(5)
    expect(result.days.every((day) => day.remaining === null)).toBe(true)
  })

  test('items with no points count as zero', () => {
    const result = burndown({ ...base, scope: [scope('a', 'committed', '2026-07-01', null)], status: [], today: at('2026-07-02') })
    expect(result.total).toBe(0)
  })
})
