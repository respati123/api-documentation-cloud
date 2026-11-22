import { type Issue, type Sprint, type StatusCategory, statusCategory } from '@/features/projects/models/issue.model'

export interface TimelineBar {
  id: string
  code: string
  title: string
  // The first and last sprint it sits in, as column indexes. Null when it is in no sprint yet.
  from: number | null
  to: number | null
  category: StatusCategory
}

export interface TimelineRow extends TimelineBar {
  items: TimelineBar[]
  done: number
  total: number
}

// Sprints in date order, the columns of the timeline.
export function timelineColumns(sprints: Sprint[]): Sprint[] {
  return [...sprints].sort((a, b) => a.startsOn.localeCompare(b.startsOn) || a.createdAt.localeCompare(b.createdAt))
}

// One row per epic. An item sits in the column of its sprint, and the epic spans from its first to its last sprint.
// An epic is done when every item is done, in progress when any item has started.
export function timelineRows(epics: Issue[], items: Issue[], columns: Sprint[], codeOf: (issue: Issue) => string): TimelineRow[] {
  const columnOf = new Map(columns.map((sprint, index) => [sprint.id, index]))
  return epics.map((epic) => {
    const own = items.filter((item) => item.parentId === epic.id)
    const bars = own.map((item): TimelineBar => {
      const at = item.sprintId ? (columnOf.get(item.sprintId) ?? null) : null
      return { id: item.id, code: codeOf(item), title: item.title, from: at, to: at, category: statusCategory(item.status) }
    })
    const placed = bars.flatMap((bar) => (bar.from === null ? [] : [bar.from]))
    const done = bars.filter((bar) => bar.category === 'done').length
    const category: StatusCategory =
      bars.length > 0 && done === bars.length ? 'done' : bars.some((bar) => bar.category !== 'todo') ? 'in_progress' : 'todo'
    return {
      id: epic.id,
      code: codeOf(epic),
      title: epic.title,
      from: placed.length > 0 ? Math.min(...placed) : null,
      to: placed.length > 0 ? Math.max(...placed) : null,
      category,
      items: bars,
      done,
      total: bars.length,
    }
  })
}
