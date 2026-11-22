import { describe, expect, test } from 'vitest'
import type { Issue } from '@/features/projects/models/issue.model'
import { boardMatches, epicLanes, itemLanes, laneProgress, roleLanes, subtaskProgress } from '@/features/projects/utils/sprint-board'

let counter = 0
function issue(over: Partial<Issue>): Issue {
  counter += 1
  return {
    id: `i${counter}`,
    projectId: 'p1',
    number: counter,
    key: `PARI-${counter}`,
    type: 'task',
    parentId: null,
    title: `Issue ${counter}`,
    description: '',
    acceptanceCriteria: '',
    userStoryRole: '',
    userStoryAction: '',
    userStoryBenefit: '',
    flow: '',
    status: 'todo',
    points: null,
    priority: 'medium',
    rank: counter,
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
    publishedAt: '2026-07-01T00:00:00Z',
    createdBy: 'u1',
    createdAt: '2026-07-01T00:00:00Z',
    updatedAt: '2026-07-01T00:00:00Z',
    ...over,
  }
}

describe('itemLanes', () => {
  test('puts each sub-task in the column of its status category, under its item', () => {
    const story = issue({ type: 'story', status: 'in_progress' })
    const a = issue({ type: 'subtask', parentId: story.id, status: 'todo', role: 'backend' })
    const b = issue({ type: 'subtask', parentId: story.id, status: 'in_review', role: 'frontend' })
    const c = issue({ type: 'subtask', parentId: story.id, status: 'done', role: 'qa' })
    const [lane] = itemLanes([story], [a, b, c])
    expect(lane.lead?.id).toBe(story.id)
    expect(lane.columns.todo.map((card) => card.id)).toEqual([a.id])
    expect(lane.columns.in_progress.map((card) => card.id)).toEqual([b.id])
    expect(lane.columns.done.map((card) => card.id)).toEqual([c.id])
  })

  test('an item without sub-tasks is its own card', () => {
    const task = issue({ type: 'task', status: 'in_review' })
    const [lane] = itemLanes([task], [])
    expect(lane.columns.in_progress.map((card) => card.id)).toEqual([task.id])
    expect(lane.columns.todo).toEqual([])
  })

  test('ignores sub-tasks of items that are not in the sprint, and keeps the order of the items', () => {
    const first = issue({ type: 'story' })
    const second = issue({ type: 'bug' })
    const stray = issue({ type: 'subtask', parentId: 'elsewhere' })
    const lanes = itemLanes([first, second], [stray])
    expect(lanes.map((lane) => lane.lead?.id)).toEqual([first.id, second.id])
    expect(lanes.flatMap((lane) => Object.values(lane.columns).flat()).some((card) => card.id === stray.id)).toBe(false)
  })
})

describe('epicLanes', () => {
  test('groups the items by epic, with the items that have none last', () => {
    const epic = issue({ type: 'epic', status: null, sprintId: null })
    const inEpic = issue({ type: 'story', parentId: epic.id, status: 'done' })
    const loose = issue({ type: 'task' })
    const lanes = epicLanes([inEpic, loose], [epic])
    expect(lanes.map((lane) => lane.lead?.id ?? null)).toEqual([epic.id, null])
    expect(lanes[0].columns.done.map((card) => card.id)).toEqual([inEpic.id])
    expect(lanes[1].columns.todo.map((card) => card.id)).toEqual([loose.id])
  })

  test('leaves out an epic that has no item in the sprint', () => {
    const epic = issue({ type: 'epic', status: null, sprintId: null })
    expect(epicLanes([issue({ type: 'task' })], [epic]).map((lane) => lane.lead?.id ?? null)).toEqual([null])
  })
})

describe('laneProgress', () => {
  test('counts the cards that are done', () => {
    const story = issue({ type: 'story' })
    const lanes = itemLanes(
      [story],
      [issue({ type: 'subtask', parentId: story.id, status: 'done' }), issue({ type: 'subtask', parentId: story.id, status: 'todo' })],
    )
    expect(laneProgress(lanes[0])).toEqual({ done: 1, total: 2 })
  })
})

describe('boardMatches', () => {
  const card = issue({ title: 'Fix the cart', assigneeId: 'u9', assigneeEmail: 'rani@example.com' })

  test('matches the title, the key, or the assignee, ignoring case', () => {
    expect(boardMatches(card, { search: 'CART', mine: false }, 'u1')).toBe(true)
    expect(boardMatches(card, { search: card.key.toLowerCase(), mine: false }, 'u1')).toBe(true)
    expect(boardMatches(card, { search: 'rani', mine: false }, 'u1')).toBe(true)
    expect(boardMatches(card, { search: 'checkout', mine: false }, 'u1')).toBe(false)
  })

  test('mine keeps only the cards assigned to the person', () => {
    expect(boardMatches(card, { search: '', mine: true }, 'u9')).toBe(true)
    expect(boardMatches(card, { search: '', mine: true }, 'u1')).toBe(false)
  })
})

describe('role lanes and sub-task progress (CLOUD-001)', () => {
  const item = (id: string, role: string | null, status = 'todo', parentId: string | null = null) =>
    ({
      id,
      key: `T-${id}`,
      title: id,
      type: role === 'sub' ? 'subtask' : 'task',
      role: role === 'sub' ? null : role,
      status,
      parentId,
    }) as unknown as Issue

  test('one lane per role in the order work flows, items without a role last', () => {
    const lanes = roleLanes([item('q', 'qa'), item('b', 'backend', 'done'), item('x', null), item('u', 'ui_ux')])
    expect(lanes.map((lane) => lane.id)).toEqual(['role-ui_ux', 'role-backend', 'role-qa', 'role-none'])
    expect(lanes[1].columns.done.map((card) => card.id)).toEqual(['b'])
    expect(lanes[3].role).toBeNull()
  })

  test('counts done and total sub-tasks per parent', () => {
    const progress = subtaskProgress([item('s1', 'sub', 'done', 't1'), item('s2', 'sub', 'todo', 't1'), item('s3', 'sub', 'done', 't2')])
    expect(progress.get('t1')).toEqual({ done: 1, total: 2 })
    expect(progress.get('t2')).toEqual({ done: 1, total: 1 })
  })
})
