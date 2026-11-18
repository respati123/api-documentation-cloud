import type { Issue } from '@/features/projects/models/issue.model'

// The open statuses of both flows in one line: a story goes draft, in design, ready, in progress, in QA. A task, bug, or
// sub-task goes to do, in progress, in review. Done is left out, as a Kanban board shows work that is still open.
export const KANBAN_STATUSES = ['draft', 'todo', 'in_design', 'ready', 'in_progress', 'in_review', 'in_qa'] as const
const ALWAYS = new Set<string>(['todo', 'in_progress'])

export interface KanbanColumn {
  status: string
  cards: Issue[]
  limit: number | null
  over: boolean
}

export function kanbanColumns(items: Issue[], limits: Array<{ status: string; limit: number }>): KanbanColumn[] {
  const limitOf = new Map(limits.map((row) => [row.status, row.limit]))
  return KANBAN_STATUSES.flatMap((status) => {
    const cards = items.filter((item) => item.status === status)
    const limit = limitOf.get(status) ?? null
    if (cards.length === 0 && limit === null && !ALWAYS.has(status)) return []
    return [{ status, cards, limit, over: limit !== null && cards.length > limit }]
  })
}
