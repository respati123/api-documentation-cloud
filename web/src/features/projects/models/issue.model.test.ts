import { describe, expect, test } from 'vitest'
import * as z from 'zod/mini'
import {
  backlogSchema,
  isBacklogItem,
  issueSchema,
  STORY_STATUSES,
  statusCategory,
  WORK_STATUSES,
} from '@/features/projects/models/issue.model'

const issue = (over: Record<string, unknown> = {}) => ({
  id: 'i1',
  projectId: 'p1',
  number: 12,
  key: 'PARI-12',
  type: 'story',
  parentId: null,
  title: 'Pay with a card',
  description: '',
  acceptanceCriteria: '',
  userStoryRole: '',
  userStoryAction: '',
  userStoryBenefit: '',
  flow: '',
  status: 'ready',
  points: 5,
  priority: 'medium',
  rank: 2048,
  sprintId: null,
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
})

describe('issue model', () => {
  test('an issue as the server sends it parses, and a missing field is refused', () => {
    expect(z.parse(issueSchema, issue()).key).toBe('PARI-12')
    const { title: _title, ...incomplete } = issue()
    expect(() => z.parse(issueSchema, incomplete)).toThrow()
    expect(() => z.parse(issueSchema, issue({ type: 'saga' }))).toThrow()
  })

  test('the backlog parses its sprints and its page of loose items', () => {
    const sprint = {
      id: 's1',
      projectId: 'p1',
      name: 'Sprint 1',
      goal: '',
      startsOn: '2026-07-01',
      endsOn: '2026-07-15',
      status: 'active',
      startedAt: null,
      closedAt: null,
      createdBy: 'u1',
      createdAt: '2026-07-01T00:00:00.000Z',
      issues: [issue()],
    }
    const parsed = z.parse(backlogSchema, { sprints: [sprint], backlog: { items: [issue({ id: 'i2' })], nextCursor: null } })
    expect(parsed.sprints[0].issues).toHaveLength(1)
    expect(parsed.backlog.nextCursor).toBeNull()
  })

  test('every status falls in one of the three categories, as on the server', () => {
    expect(STORY_STATUSES.map(statusCategory)).toEqual(['todo', 'todo', 'todo', 'in_progress', 'in_progress', 'done'])
    expect(WORK_STATUSES.map(statusCategory)).toEqual(['todo', 'in_progress', 'in_progress', 'done'])
  })

  test('a status the page does not know goes to the first column, and an epic has none', () => {
    expect(statusCategory('something_new')).toBe('todo')
    expect(statusCategory(null)).toBe('todo')
  })

  test('story, task, and bug are the items that can be ranked and put in a sprint', () => {
    expect((['epic', 'story', 'task', 'bug', 'subtask'] as const).map(isBacklogItem)).toEqual([false, true, true, true, false])
  })
})
