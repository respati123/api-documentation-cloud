import { describe, expect, test } from 'vitest'
import type { PlanningDocumentSummary, PlanningItem } from '@/features/projects/models/planning.model'
import { headingsOf, isOverdue, itemCodes, pipelineCounts, waitingQueue } from '@/features/projects/utils/planning'

function doc(overrides: Partial<PlanningDocumentSummary>): PlanningDocumentSummary {
  return {
    id: 'd',
    kind: 'prd',
    title: 'PRD',
    status: 'draft',
    currentVersion: 1,
    sourceDocumentId: null,
    sourceOutdated: false,
    updatedAt: '2026-11-01',
    ...overrides,
  }
}

function item(overrides: Partial<PlanningItem>): PlanningItem {
  return {
    id: 'i',
    kind: 'story',
    parentId: null,
    title: 'Item',
    description: '',
    acceptanceCriteria: '',
    status: 'draft',
    publishedAt: null,
    sourceDocumentId: 'd',
    sourceVersion: 1,
    sourceOutdated: false,
    sourceSection: null,
    participantIds: [],
    ...overrides,
  }
}

describe('itemCodes', () => {
  test('numbers epics and stories separately in creation order', () => {
    const codes = itemCodes([
      item({ id: 's2', createdAt: '2026-11-03' }),
      item({ id: 'e1', kind: 'epic', createdAt: '2026-11-01' }),
      item({ id: 's1', createdAt: '2026-11-02' }),
    ])
    expect(codes).toEqual({ e1: 'EP-1', s1: 'ST-1', s2: 'ST-2' })
  })
})

describe('headings and blocks', () => {
  const markdown = '# Title\nIntro\n## Goals\nShip it\n### Detail\nMore'

  test('the table of contents lists level two and three headings only', () => {
    expect(headingsOf(markdown).map((heading) => [heading.level, heading.text])).toEqual([
      [2, 'Goals'],
      [3, 'Detail'],
    ])
  })
})

describe('waitingQueue', () => {
  const documents = [doc({ id: 'p1', status: 'review_team' }), doc({ id: 'p2', status: 'draft' })]
  const items = [item({ id: 'e1', kind: 'epic', status: 'ready' }), item({ id: 's1' })]

  test('an approver who is not PM sees only the PRD waiting for approval', () => {
    expect(waitingQueue(documents, items, { canManage: false, canApprove: true }).map((entry) => entry.reason)).toEqual(['approve_prd'])
  })

  test('a PM sees approvals, PRD reviews, epics to publish, and drafts to refine', () => {
    expect(waitingQueue(documents, items, { canManage: true, canApprove: true }).map((entry) => entry.reason)).toEqual([
      'approve_prd',
      'review_prd',
      'publish_epic',
      'refine_item',
    ])
  })
})

describe('pipelineCounts', () => {
  test('superseded PRDs are left out', () => {
    const counts = pipelineCounts(
      [doc({ status: 'superseded' }), doc({ status: 'approved' }), doc({ kind: 'brd', status: 'approved' })],
      [],
      [],
    )
    expect(counts.prd).toEqual({ total: 1, inReview: 0, approved: 1 })
    expect(counts.brd).toEqual({ total: 1, approved: 1 })
  })
})

describe('isOverdue', () => {
  const today = new Date(2026, 10, 12)

  test('a task due yesterday and not done is overdue', () => {
    expect(isOverdue('2026-11-11', 'todo', today)).toBe(true)
  })

  test('a task due today, a done task, and a task without a date are not overdue', () => {
    expect(isOverdue('2026-11-12', 'todo', today)).toBe(false)
    expect(isOverdue('2026-11-01', 'done', today)).toBe(false)
    expect(isOverdue(null, 'todo', today)).toBe(false)
  })
})
