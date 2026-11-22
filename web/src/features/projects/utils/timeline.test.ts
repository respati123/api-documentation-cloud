import { describe, expect, test } from 'vitest'
import type { Issue, Sprint } from '@/features/projects/models/issue.model'
import { timelineColumns, timelineRows } from '@/features/projects/utils/timeline'

const sprint = (id: string, startsOn: string) => ({ id, startsOn, createdAt: startsOn, name: id }) as unknown as Sprint
const issue = (id: string, over: Partial<Issue> = {}) =>
  ({ id, key: `T-${id}`, title: id, type: 'task', parentId: null, sprintId: null, status: 'todo', ...over }) as Issue

describe('timeline', () => {
  test('sprints are ordered by start date', () => {
    expect(timelineColumns([sprint('b', '2026-12-15'), sprint('a', '2026-12-01')]).map((item) => item.id)).toEqual(['a', 'b'])
  })

  test('an epic spans its first to last sprint, and its items sit in their sprint', () => {
    const columns = timelineColumns([sprint('s1', '2026-12-01'), sprint('s2', '2026-12-15'), sprint('s3', '2027-01-05')])
    const epic = issue('e', { type: 'epic' })
    const items = [
      issue('a', { parentId: 'e', sprintId: 's1', status: 'done' }),
      issue('b', { parentId: 'e', sprintId: 's3', status: 'in_progress' }),
      issue('c', { parentId: 'e' }),
    ]
    const [row] = timelineRows([epic], items, columns, (item) => item.key)
    expect(row).toMatchObject({ from: 0, to: 2, category: 'in_progress', done: 1, total: 3 })
    expect(row.items.map((bar) => [bar.id, bar.from, bar.category])).toEqual([
      ['a', 0, 'done'],
      ['b', 2, 'in_progress'],
      ['c', null, 'todo'],
    ])
  })

  test('an epic with every item done is done, and one with no sprint yet has no span', () => {
    const columns = timelineColumns([sprint('s1', '2026-12-01')])
    const done = timelineRows(
      [issue('e', { type: 'epic' })],
      [issue('a', { parentId: 'e', sprintId: 's1', status: 'done' })],
      columns,
      (item) => item.key,
    )
    expect(done[0].category).toBe('done')
    const waiting = timelineRows([issue('f', { type: 'epic' })], [issue('b', { parentId: 'f' })], columns, (item) => item.key)
    expect(waiting[0]).toMatchObject({ from: null, to: null, category: 'todo' })
  })
})
