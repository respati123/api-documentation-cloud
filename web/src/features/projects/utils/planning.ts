import type {
  DocumentStatus,
  PlanningDocumentSummary,
  PlanningItem,
  PlanningStatus,
  PlanningTask,
} from '@/features/projects/models/planning.model'
import type { Inline, MarkdownBlock } from '@/shared/utils/markdown'

export const DOCUMENT_NEXT: Record<DocumentStatus, DocumentStatus | null> = {
  draft: 'review_pm',
  review_pm: 'review_team',
  review_team: 'approved',
  approved: 'superseded',
  superseded: null,
  discarded: null,
}

// A PRD is approved from team review. A BRD an agent uploaded is confirmed from draft.
export function canApproveDocument(document: { kind: string; status: DocumentStatus; sourceOutdated?: boolean | null }): boolean {
  if (document.kind === 'brd') return document.status === 'draft'
  return document.status === 'review_team' && !document.sourceOutdated
}

export type DocumentFormat = 'pdf' | 'markdown' | 'text'

// An uploaded PDF is shown as the file itself. Text from a DOCX or a .txt has no markdown, so it is shown as plain text.
export function documentFormat(mimeType: string | null | undefined): DocumentFormat {
  if (mimeType === 'application/pdf') return 'pdf'
  if (!mimeType || mimeType === 'text/markdown') return 'markdown'
  return 'text'
}

export interface RequirementLabels {
  id: string
  requirement: string
  priority: string
  reference: string
}

type Cell = Inline[]

const REQUIREMENT = /^(R\d+)[.:)]?\s+(.+?)\s*\(\s*(must|should|could|wajib|sebaiknya|opsional|bisa)\s*\)\.?\s*(?:\[([^\]]+)\])?\.?$/i
// A label may end with a note in brackets that has its own colon, as in "Admin (11 roles: KYC, Finance)".
const LABELLED = /^([^:(]{1,64}(?:\s*\([^)]*\))?):\s+(.+)$/

function plainText(nodes: Inline[]): string {
  return nodes
    .map((node) => {
      if (node.type === 'text' || node.type === 'code') return node.text
      if (node.type === 'link') return plainText(node.label)
      return plainText(node.children)
    })
    .join('')
}

const textCell = (text: string): Cell => [{ type: 'text', text }]
const chipCell = (text: string | undefined): Cell => (text ? [{ type: 'code', text }] : [])

function requirementTable(lines: string[], labels: RequirementLabels): MarkdownBlock | null {
  const matches = lines.map((line) => REQUIREMENT.exec(line))
  if (matches.some((match) => !match)) return null
  const rows = matches.map((match) => match as RegExpExecArray)
  const withReference = rows.some((match) => match[4])
  const header = [labels.id, labels.requirement, labels.priority, ...(withReference ? [labels.reference] : [])]
  return {
    type: 'table',
    hasHeader: true,
    align: header.map(() => 'left' as const),
    header: header.map(textCell),
    rows: rows.map((match) => [textCell(match[1]), textCell(match[2]), chipCell(match[3]), ...(withReference ? [chipCell(match[4])] : [])]),
  }
}

// A list where every item starts with its own short label reads better as label and value columns.
function labelTable(items: string[]): MarkdownBlock | null {
  const matches = items.map((item) => LABELLED.exec(item))
  if (items.length < 2 || matches.some((match) => !match)) return null
  const rows = matches.map((match) => match as RegExpExecArray)
  if (new Set(rows.map((match) => match[1].toLowerCase())).size !== rows.length) return null
  return {
    type: 'table',
    hasHeader: false,
    align: ['left', 'left'],
    header: [],
    rows: rows.map((match) => [textCell(match[1]), textCell(match[2])]),
  }
}

// Shows requirement lines and labelled lists of a BRD or PRD as tables. The stored text is unchanged,
// because epics quote requirement lines from it character for character.
export function tidyDocumentBlocks(blocks: MarkdownBlock[], labels: RequirementLabels): MarkdownBlock[] {
  return blocks.map((block) => {
    if (block.type === 'paragraph') return requirementTable(block.lines.map(plainText), labels) ?? block
    if (block.type !== 'list' || block.items.some((item) => item.children.length > 0)) return block
    const items = block.items.map((item) => plainText(item.content))
    return requirementTable(items, labels) ?? labelTable(items) ?? block
  })
}

// A draft or a document in review that should not go on is discarded by an approver and kept for the record.
// The owner or a PM deletes a draft or a discarded document, when no other document is drafted from it.
export function documentRemoval(
  document: { status: DocumentStatus },
  access: { canManage: boolean; canApprove: boolean },
  dependents = 0,
): { canDiscard: boolean; canDelete: boolean } {
  return {
    canDiscard: access.canApprove && ['draft', 'review_pm', 'review_team'].includes(document.status),
    canDelete: access.canManage && dependents === 0 && (document.status === 'draft' || document.status === 'discarded'),
  }
}

export const ITEM_NEXT: Record<PlanningStatus, PlanningStatus | null> = {
  draft: 'refinement',
  refinement: 'ready',
  ready: 'in_progress',
  in_progress: 'review',
  review: 'done',
  done: null,
}

// Short codes like EP-1 and ST-4, numbered per kind in creation order. Items are never deleted, so a code stays put.
export function itemCodes(items: PlanningItem[]): Record<string, string> {
  const ordered = [...items].sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  const counters = { epic: 0, story: 0 }
  const codes: Record<string, string> = {}
  for (const item of ordered) {
    counters[item.kind] += 1
    codes[item.id] = `${item.kind === 'epic' ? 'EP' : 'ST'}-${counters[item.kind]}`
  }
  return codes
}

export interface Heading {
  id: string
  level: 2 | 3
  text: string
}

// Second- and third-level markdown headings, for the document's table of contents.
export function headingsOf(markdown: string): Heading[] {
  return markdown.split('\n').flatMap((line, index) => {
    const match = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line)
    if (!match) return []
    return [{ id: `section-${index}`, level: match[1].length as 2 | 3, text: match[2] }]
  })
}

export interface PipelineCounts {
  brd: { total: number; approved: number }
  prd: { total: number; inReview: number; approved: number }
  epic: { total: number; published: number }
  story: { total: number; ready: number; done: number }
  task: { total: number; draft: number; done: number }
}

export function pipelineCounts(documents: PlanningDocumentSummary[], items: PlanningItem[], tasks: PlanningTask[]): PipelineCounts {
  const brds = documents.filter((document) => document.kind === 'brd')
  const prds = documents.filter(
    (document) => document.kind === 'prd' && document.status !== 'superseded' && document.status !== 'discarded',
  )
  const epics = items.filter((item) => item.kind === 'epic')
  const stories = items.filter((item) => item.kind === 'story')
  return {
    brd: { total: brds.length, approved: brds.filter((document) => document.status === 'approved').length },
    prd: {
      total: prds.length,
      inReview: prds.filter((document) => document.status === 'review_pm' || document.status === 'review_team').length,
      approved: prds.filter((document) => document.status === 'approved').length,
    },
    epic: { total: epics.length, published: epics.filter((item) => item.publishedAt).length },
    story: {
      total: stories.length,
      ready: stories.filter((item) => item.status === 'ready').length,
      done: stories.filter((item) => item.status === 'done').length,
    },
    task: {
      total: tasks.length,
      draft: tasks.filter((task) => !task.publishedAt).length,
      done: tasks.filter((task) => task.status === 'done').length,
    },
  }
}

export type WaitingReason = 'confirm_brd' | 'approve_prd' | 'review_prd' | 'refine_item' | 'publish_epic' | 'source_changed'

export interface WaitingEntry {
  reason: WaitingReason
  target: { kind: 'document'; id: string } | { kind: 'item'; id: string }
  title: string
}

// What needs a human decision now. Approvers see PRDs waiting for approval; PMs also see drafts to refine and epics to publish.
export function waitingQueue(
  documents: PlanningDocumentSummary[],
  items: PlanningItem[],
  access: { canManage: boolean; canApprove: boolean },
): WaitingEntry[] {
  const entries: WaitingEntry[] = []
  for (const document of documents) {
    if (document.kind === 'brd') {
      if (document.status === 'draft' && access.canApprove)
        entries.push({ reason: 'confirm_brd', target: { kind: 'document', id: document.id }, title: document.title })
      continue
    }
    if (document.status === 'review_team' && access.canApprove)
      entries.push({ reason: 'approve_prd', target: { kind: 'document', id: document.id }, title: document.title })
    else if ((document.status === 'draft' || document.status === 'review_pm') && access.canManage)
      entries.push({ reason: 'review_prd', target: { kind: 'document', id: document.id }, title: document.title })
  }
  if (access.canManage) {
    for (const item of items) {
      if (item.sourceOutdated && !item.publishedAt)
        entries.push({ reason: 'source_changed', target: { kind: 'item', id: item.id }, title: item.title })
      else if (item.kind === 'epic' && item.status === 'ready' && !item.publishedAt)
        entries.push({ reason: 'publish_epic', target: { kind: 'item', id: item.id }, title: item.title })
      else if (item.status === 'draft' && !item.publishedAt)
        entries.push({ reason: 'refine_item', target: { kind: 'item', id: item.id }, title: item.title })
    }
  }
  return entries
}

export function progressOf(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

// A due date is a calendar day, so it is overdue only from the next day on.
export function isOverdue(dueDate: string | null, status: string, today = new Date()): boolean {
  if (!dueDate || status === 'done') return false
  const local = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  return dueDate < local
}
