import { describe, expect, test } from 'vitest'
import type { PlanningDocumentSummary, PlanningItem } from '@/features/projects/models/planning.model'
import {
  canApproveDocument,
  documentFormat,
  documentRemoval,
  headingsOf,
  isOverdue,
  itemCodes,
  pipelineCounts,
  tidyDocumentBlocks,
  waitingQueue,
} from '@/features/projects/utils/planning'
import { type MarkdownBlock, parseMarkdown } from '@/shared/utils/markdown'

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

describe('BRD from an agent', () => {
  test('a draft BRD waits for an approver to confirm it, and a confirmed one does not', () => {
    const documents = [doc({ id: 'b1', kind: 'brd', status: 'draft' }), doc({ id: 'b2', kind: 'brd', status: 'approved' })]

    expect(waitingQueue(documents, [], { canManage: false, canApprove: true })).toEqual([
      { reason: 'confirm_brd', target: { kind: 'document', id: 'b1' }, title: 'PRD' },
    ])
    expect(waitingQueue(documents, [], { canManage: true, canApprove: false })).toEqual([])
  })

  test('a BRD is confirmed from draft, and a PRD is approved from team review while its BRD is current', () => {
    expect(canApproveDocument(doc({ kind: 'brd', status: 'draft' }))).toBe(true)
    expect(canApproveDocument(doc({ kind: 'brd', status: 'approved' }))).toBe(false)
    expect(canApproveDocument(doc({ kind: 'prd', status: 'review_team' }))).toBe(true)
    expect(canApproveDocument(doc({ kind: 'prd', status: 'review_team', sourceOutdated: true }))).toBe(false)
    expect(canApproveDocument(doc({ kind: 'prd', status: 'draft' }))).toBe(false)
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

describe('documentFormat', () => {
  test('shows an uploaded PDF as the original file', () => {
    expect(documentFormat('application/pdf')).toBe('pdf')
  })

  test('renders markdown files and typed documents as markdown', () => {
    expect(documentFormat('text/markdown')).toBe('markdown')
    expect(documentFormat(null)).toBe('markdown')
    expect(documentFormat(undefined)).toBe('markdown')
  })

  test('shows plain text and text extracted from DOCX as plain text', () => {
    expect(documentFormat('text/plain')).toBe('text')
    expect(documentFormat('application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBe('text')
  })
})

describe('tidyDocumentBlocks', () => {
  const labels = { id: 'ID', requirement: 'Requirement', priority: 'Priority', reference: 'Reference' }
  const tidy = (markdown: string) => tidyDocumentBlocks(parseMarkdown(markdown), labels)
  const text = (cell: unknown) => JSON.stringify(cell)

  test('turns requirement lines into a table with id, text, priority, and reference', () => {
    const [block] = tidy('R1 Owner invites by email. (must) [UC-FR-001]\nR2 Admin can revoke access (should)')
    expect(block.type).toBe('table')
    const table = block as Extract<MarkdownBlock, { type: 'table' }>
    expect(table.header.map(text)).toEqual(
      [labels.id, labels.requirement, labels.priority, labels.reference].map((label) => text([{ type: 'text', text: label }])),
    )
    expect(table.rows).toHaveLength(2)
    expect(text(table.rows[0][0])).toContain('R1')
    expect(text(table.rows[0][1])).toContain('Owner invites by email.')
    expect(text(table.rows[0][2])).toContain('must')
    expect(text(table.rows[0][3])).toContain('UC-FR-001')
    expect(table.rows[1][3]).toEqual([])
  })

  test('leaves out the reference column when no requirement has one, and reads bulleted requirements', () => {
    const [block] = tidy('- R1 Owner bisa mengundang dengan email (wajib).\n- R2 Owner bisa mengubah peran (wajib)')
    const table = block as Extract<MarkdownBlock, { type: 'table' }>
    expect(table.type).toBe('table')
    expect(table.header).toHaveLength(3)
    expect(text(table.rows[0][2])).toContain('wajib')
  })

  test('keeps a paragraph as it is when one line is not a requirement', () => {
    expect(tidy('Prioritas: must = P0.\nR1 Owner invites (must)')[0].type).toBe('paragraph')
  })

  test('turns a list of distinct "Label: text" items into a two-column table', () => {
    const [block] = tidy('- Keamanan: OIDC dan MFA.\n- Performa: query terindeks.')
    const table = block as Extract<MarkdownBlock, { type: 'table' }>
    expect(table.type).toBe('table')
    expect(table.hasHeader).toBe(false)
    expect(text(table.rows[0][0])).toContain('Keamanan')
    expect(text(table.rows[0][1])).toContain('OIDC dan MFA.')
  })

  test('reads long labels and a bracketed note with its own colon as part of the label', () => {
    const [block] = tidy(
      '- Supply Partner, Commodity Producer, Supply Aggregator: menjual komoditas.\n- Admin (11 role: KYC, Finance): verifikasi.',
    )
    const table = block as Extract<MarkdownBlock, { type: 'table' }>
    expect(table.type).toBe('table')
    expect(text(table.rows[1][0])).toContain('Admin (11 role: KYC, Finance)')
    expect(text(table.rows[1][1])).toContain('verifikasi.')
  })

  test('keeps lists whose items repeat a label or have no label', () => {
    expect(tidy('- Asumsi: satu.\n- Asumsi: dua.')[0].type).toBe('list')
    expect(tidy('- Internal wallet.\n- Keamanan: OIDC.')[0].type).toBe('list')
  })
})

describe('documentRemoval', () => {
  const managers = { canManage: true, canApprove: true }
  const techLead = { canManage: false, canApprove: true }

  test('a draft or a document in review can be discarded by an approver', () => {
    for (const status of ['draft', 'review_pm', 'review_team'] as const)
      expect(documentRemoval(doc({ status }), techLead).canDiscard).toBe(true)
    expect(documentRemoval(doc({ status: 'approved' }), managers).canDiscard).toBe(false)
    expect(documentRemoval(doc({ status: 'discarded' }), managers).canDiscard).toBe(false)
    expect(documentRemoval(doc({ status: 'draft' }), { canManage: false, canApprove: false }).canDiscard).toBe(false)
  })

  test('the owner or a PM deletes a draft or a discarded document that nothing is drafted from', () => {
    expect(documentRemoval(doc({ status: 'draft' }), managers).canDelete).toBe(true)
    expect(documentRemoval(doc({ status: 'discarded' }), managers).canDelete).toBe(true)
    expect(documentRemoval(doc({ status: 'review_pm' }), managers).canDelete).toBe(false)
    expect(documentRemoval(doc({ status: 'draft' }), techLead).canDelete).toBe(false)
    expect(documentRemoval(doc({ status: 'draft' }), managers, 1).canDelete).toBe(false)
  })
})
