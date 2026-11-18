import { describe, expect, test } from 'vitest'
import type { Issue } from '@/features/projects/models/issue.model'
import { KANBAN_STATUSES, kanbanColumns } from '@/features/projects/utils/kanban-board'

function issue(id: string, over: Partial<Issue> = {}): Issue {
  return {
    id,
    projectId: 'p1',
    number: 1,
    key: `PARI-${id}`,
    type: 'task',
    parentId: null,
    title: `Item ${id}`,
    description: '',
    acceptanceCriteria: '',
    userStoryRole: '',
    userStoryAction: '',
    userStoryBenefit: '',
    flow: '',
    status: 'todo',
    points: 3,
    priority: 'medium',
    rank: 1024,
    sprintId: 's1',
    role: null,
    assigneeId: null,
    assigneeEmail: null,
    dueDate: null,
    sourceDocumentId: null,
    sourceVersion: null,
    sourceSection: null,
    sourceReviewedVersion: null,
    sourceOutdated: null,
    designApprovedBy: null,
    designApprovedAt: null,
    testCaseId: null,
    publishedAt: '2026-07-01T00:00:00.000Z',
    createdBy: 'u1',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    ...over,
  }
}

describe('kanbanColumns', () => {
  test('always has To do and In progress, in the order of the flow', () => {
    expect(kanbanColumns([], []).map((column) => column.status)).toEqual(['todo', 'in_progress'])
    expect(KANBAN_STATUSES.indexOf('todo')).toBeLessThan(KANBAN_STATUSES.indexOf('in_progress'))
  })

  test('adds a column for every other status that has a card or a limit', () => {
    const items = [issue('a', { status: 'in_review' }), issue('b', { type: 'story', status: 'in_qa' })]
    const columns = kanbanColumns(items, [{ status: 'ready', limit: 3 }])
    expect(columns.map((column) => column.status)).toEqual(['todo', 'ready', 'in_progress', 'in_review', 'in_qa'])
  })

  test('puts each card in the column of its status, and leaves finished work out', () => {
    const items = [issue('a', { status: 'todo' }), issue('b', { status: 'in_progress' }), issue('c', { status: 'done' })]
    const columns = kanbanColumns(items, [])
    expect(columns[0].cards.map((card) => card.id)).toEqual(['a'])
    expect(columns[1].cards.map((card) => card.id)).toEqual(['b'])
    expect(columns.flatMap((column) => column.cards).some((card) => card.id === 'c')).toBe(false)
  })

  test('a column is over its limit only when it holds more cards than the limit', () => {
    const items = [issue('a', { status: 'in_progress' }), issue('b', { status: 'in_progress' })]
    expect(kanbanColumns(items, [{ status: 'in_progress', limit: 2 }])[1]).toMatchObject({ limit: 2, over: false })
    expect(kanbanColumns(items, [{ status: 'in_progress', limit: 1 }])[1]).toMatchObject({ limit: 1, over: true })
    expect(kanbanColumns(items, [])[1]).toMatchObject({ limit: null, over: false })
  })

  test('ignores items without a status, as an epic has none', () => {
    const columns = kanbanColumns([issue('e', { type: 'epic', status: null })], [])
    expect(columns.flatMap((column) => column.cards)).toEqual([])
  })
})
