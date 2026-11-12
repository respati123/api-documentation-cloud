import type {
  DocumentStatus,
  PlanningDocumentSummary,
  PlanningItem,
  PlanningStatus,
  PlanningTask,
} from '@/features/projects/models/planning.model'

export const DOCUMENT_NEXT: Record<DocumentStatus, DocumentStatus | null> = {
  draft: 'review_pm',
  review_pm: 'review_team',
  review_team: 'approved',
  approved: 'superseded',
  superseded: null,
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

export type DocumentBlock = { type: 'heading'; heading: Heading } | { type: 'text'; text: string }

// Splits a document into headings and the text between them, so each heading can be an anchor.
export function documentBlocks(markdown: string): DocumentBlock[] {
  const headings = new Map(headingsOf(markdown).map((heading) => [heading.id, heading]))
  const blocks: DocumentBlock[] = []
  let buffer: string[] = []
  const flush = () => {
    const text = buffer.join('\n').trim()
    if (text) blocks.push({ type: 'text', text })
    buffer = []
  }
  markdown.split('\n').forEach((line, index) => {
    const heading = headings.get(`section-${index}`)
    if (heading) {
      flush()
      blocks.push({ type: 'heading', heading })
    } else if (!/^#\s/.test(line)) buffer.push(line)
  })
  flush()
  return blocks
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
  const prds = documents.filter((document) => document.kind === 'prd' && document.status !== 'superseded')
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

export type WaitingReason = 'approve_prd' | 'review_prd' | 'refine_item' | 'publish_epic' | 'source_changed'

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
    if (document.kind !== 'prd') continue
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
