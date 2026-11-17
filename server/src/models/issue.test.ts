import { describe, expect, test } from 'bun:test'
import {
  allowedStatuses,
  epicStatus,
  ISSUE_TYPES,
  isBacklogItem,
  isPoints,
  RANK_STEP,
  rankBetween,
  statusCategory,
  STORY_STATUSES,
  WORK_STATUSES,
} from '@/models/issue'

describe('statuses', () => {
  test('every status has a category', () => {
    for (const status of [...STORY_STATUSES, ...WORK_STATUSES]) {
      expect(['todo', 'in_progress', 'done']).toContain(statusCategory(status))
    }
  })

  test('story statuses run draft to done and group into the three categories', () => {
    expect(STORY_STATUSES).toEqual(['draft', 'in_design', 'ready', 'in_progress', 'in_qa', 'done'])
    expect(['draft', 'in_design', 'ready'].map(statusCategory)).toEqual(['todo', 'todo', 'todo'])
    expect(['in_progress', 'in_qa'].map(statusCategory)).toEqual(['in_progress', 'in_progress'])
    expect(statusCategory('done')).toBe('done')
  })

  test('task, bug and sub-task share one list that includes in_review', () => {
    expect(WORK_STATUSES).toEqual(['todo', 'in_progress', 'in_review', 'done'])
    expect(statusCategory('in_review')).toBe('in_progress')
    for (const type of ['task', 'bug', 'subtask'] as const) expect(allowedStatuses(type)).toEqual(WORK_STATUSES)
  })

  test('a story has its own list and an epic has none', () => {
    expect(allowedStatuses('story')).toEqual(STORY_STATUSES)
    expect(allowedStatuses('epic')).toEqual([])
  })

  test('an unknown status is refused', () => {
    expect(() => statusCategory('backlog')).toThrow()
  })
})

describe('epicStatus', () => {
  test('an epic with no children is todo', () => {
    expect(epicStatus([])).toBe('todo')
  })

  test('an epic is todo while every child is todo', () => {
    expect(epicStatus(['draft', 'todo', 'ready'])).toBe('todo')
  })

  test('an epic is in progress when any child is past todo but not all are done', () => {
    expect(epicStatus(['todo', 'in_progress'])).toBe('in_progress')
    expect(epicStatus(['done', 'todo'])).toBe('in_progress')
    expect(epicStatus(['in_qa', 'done'])).toBe('in_progress')
  })

  test('an epic is done only when every child is done', () => {
    expect(epicStatus(['done', 'done'])).toBe('done')
  })
})

describe('points and types', () => {
  test('points are Fibonacci values from 1 to 13', () => {
    for (const value of [1, 2, 3, 5, 8, 13]) expect(isPoints(value)).toBe(true)
    for (const value of [0, 4, 6, 14, -1, 2.5, '3', null]) expect(isPoints(value)).toBe(false)
  })

  test('story, task and bug are backlog items, epic and sub-task are not', () => {
    expect(ISSUE_TYPES).toEqual(['epic', 'story', 'task', 'bug', 'subtask'])
    expect(['story', 'task', 'bug'].map((type) => isBacklogItem(type as never))).toEqual([true, true, true])
    expect(isBacklogItem('epic')).toBe(false)
    expect(isBacklogItem('subtask')).toBe(false)
  })
})

describe('rankBetween', () => {
  test('the first item in an empty backlog gets one step', () => {
    expect(rankBetween(null, null)).toBe(RANK_STEP)
  })

  test('an item after the last one goes one step further', () => {
    expect(rankBetween(3 * RANK_STEP, null)).toBe(4 * RANK_STEP)
  })

  test('an item before the first one goes halfway to zero', () => {
    expect(rankBetween(null, RANK_STEP)).toBe(RANK_STEP / 2)
  })

  test('an item between two others goes in the middle', () => {
    expect(rankBetween(RANK_STEP, 2 * RANK_STEP)).toBe(1.5 * RANK_STEP)
    expect(rankBetween(10, 14)).toBe(12)
  })

  test('there is no room when the neighbours are next to each other or the top has no space left', () => {
    expect(rankBetween(10, 11)).toBeNull()
    expect(rankBetween(10, 10)).toBeNull()
    expect(rankBetween(null, 1)).toBeNull()
  })
})
