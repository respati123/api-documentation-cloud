import { describe, expect, test } from 'vitest'
import { daysLeft, dropPlacement, epicCounts, filterByEpic, NO_EPIC, readyGaps, sprintTotals } from '@/features/projects/utils/backlog'

describe('readyGaps', () => {
  test('a story needs to be Ready and have points, a task only needs points', () => {
    expect(readyGaps({ type: 'story', status: 'draft', points: null })).toEqual(['status', 'points'])
    expect(readyGaps({ type: 'story', status: 'ready', points: 3 })).toEqual([])
    expect(readyGaps({ type: 'story', status: 'ready', points: null })).toEqual(['points'])
    expect(readyGaps({ type: 'task', status: 'todo', points: null })).toEqual(['points'])
    expect(readyGaps({ type: 'bug', status: 'todo', points: 2 })).toEqual([])
  })
})

describe('sprintTotals', () => {
  test('counts items and points, and what is done', () => {
    expect(
      sprintTotals([
        { status: 'done', points: 3 },
        { status: 'in_progress', points: 5 },
        { status: 'todo', points: null },
        { status: 'done', points: null },
      ]),
    ).toEqual({ items: 4, done: 2, points: 8, donePoints: 3 })
  })

  test('an empty sprint has no totals', () => {
    expect(sprintTotals([])).toEqual({ items: 0, done: 0, points: 0, donePoints: 0 })
  })
})

describe('daysLeft', () => {
  const today = new Date('2026-07-10T15:30:00Z')
  test('counts whole days to the end date', () => {
    expect(daysLeft('2026-07-17', today)).toBe(7)
    expect(daysLeft('2026-07-11', today)).toBe(1)
  })

  test('is zero on the last day and after it, and for a bad date', () => {
    expect(daysLeft('2026-07-10', today)).toBe(0)
    expect(daysLeft('2026-07-01', today)).toBe(0)
    expect(daysLeft('not a date', today)).toBe(0)
  })
})

describe('epic filter', () => {
  const issues = [{ parentId: 'e1' }, { parentId: 'e2' }, { parentId: null }, { parentId: 'e1' }]
  test('shows everything, one epic, or the items without an epic', () => {
    expect(filterByEpic(issues, '')).toHaveLength(4)
    expect(filterByEpic(issues, 'e1')).toHaveLength(2)
    expect(filterByEpic(issues, NO_EPIC)).toEqual([{ parentId: null }])
  })

  test('counts per epic, with epics that hold nothing at zero', () => {
    expect(epicCounts([{ id: 'e1' }, { id: 'e2' }, { id: 'e3' }], issues)).toEqual({ byEpic: { e1: 2, e2: 1, e3: 0 }, withoutEpic: 1 })
  })
})

describe('dropPlacement', () => {
  const lists = { s1: ['a', 'b', 'c'], backlog: ['x', 'y'], empty: [] as string[] }

  test('in the same list the item takes the neighbours at its new place, without itself', () => {
    expect(dropPlacement(lists, 's1', 'a', 2)).toEqual({ afterId: 'c', beforeId: null })
    expect(dropPlacement(lists, 's1', 'a', 1)).toEqual({ afterId: 'b', beforeId: 'c' })
    expect(dropPlacement(lists, 's1', 'c', 0)).toEqual({ afterId: null, beforeId: 'a' })
    expect(dropPlacement(lists, 's1', 'a', 0)).toEqual({ afterId: null, beforeId: 'b' })
  })

  test('in another list it goes between the items at that index', () => {
    expect(dropPlacement(lists, 'backlog', 'a', 1)).toEqual({ afterId: 'x', beforeId: 'y' })
    expect(dropPlacement(lists, 'backlog', 'a', 2)).toEqual({ afterId: 'y', beforeId: null })
  })

  test('into an empty list there is nothing to place it against', () => {
    expect(dropPlacement(lists, 'empty', 'a', 0)).toEqual({ afterId: null, beforeId: null })
  })

  test('an unknown list has no neighbours', () => {
    expect(dropPlacement(lists, 'nowhere', 'a', 3)).toEqual({ afterId: null, beforeId: null })
  })
})
