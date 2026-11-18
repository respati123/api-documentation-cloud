import { type Issue, type StatusCategory, statusCategory } from '@/features/projects/models/issue.model'

export const BOARD_COLUMNS: readonly StatusCategory[] = ['todo', 'in_progress', 'done']

export interface Lane {
  id: string
  // The item or epic the lane is about. The lane of items that have no epic has none.
  lead: Issue | null
  columns: Record<StatusCategory, Issue[]>
}

const emptyColumns = (): Record<StatusCategory, Issue[]> => ({ todo: [], in_progress: [], done: [] })

function place(columns: Record<StatusCategory, Issue[]>, card: Issue) {
  columns[statusCategory(card.status)].push(card)
}

// One lane per item of the sprint, its sub-tasks as cards. An item with no sub-tasks is its own card.
export function itemLanes(items: Issue[], subtasks: Issue[]): Lane[] {
  const byParent = new Map<string, Issue[]>()
  for (const subtask of subtasks) {
    byParent.set(subtask.parentId ?? '', [...(byParent.get(subtask.parentId ?? '') ?? []), subtask])
  }
  return items.map((item) => {
    const columns = emptyColumns()
    const children = byParent.get(item.id) ?? []
    for (const card of children.length > 0 ? children : [item]) place(columns, card)
    return { id: item.id, lead: item, columns }
  })
}

// One lane per epic that has an item in the sprint, the items as cards. The items without an epic come last.
export function epicLanes(items: Issue[], epics: Issue[]): Lane[] {
  const lanes: Lane[] = []
  for (const epic of epics) {
    const own = items.filter((item) => item.parentId === epic.id)
    if (own.length === 0) continue
    const columns = emptyColumns()
    for (const item of own) place(columns, item)
    lanes.push({ id: epic.id, lead: epic, columns })
  }
  const known = new Set(epics.map((epic) => epic.id))
  const loose = items.filter((item) => !item.parentId || !known.has(item.parentId))
  if (loose.length > 0) {
    const columns = emptyColumns()
    for (const item of loose) place(columns, item)
    lanes.push({ id: 'none', lead: null, columns })
  }
  return lanes
}

export function laneProgress(lane: Lane): { done: number; total: number } {
  const total = BOARD_COLUMNS.reduce((sum, column) => sum + lane.columns[column].length, 0)
  return { done: lane.columns.done.length, total }
}

export interface BoardFilter {
  search: string
  mine: boolean
}

export function boardMatches(card: Issue, filter: BoardFilter, userId: string): boolean {
  if (filter.mine && card.assigneeId !== userId) return false
  const needle = filter.search.trim().toLowerCase()
  if (needle === '') return true
  return [card.title, card.key, card.assigneeEmail ?? ''].some((value) => value.toLowerCase().includes(needle))
}
