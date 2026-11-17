import { type Issue, statusCategory } from '@/features/projects/models/issue.model'

// Filter value for the items that belong to no epic. An empty value shows every item.
export const NO_EPIC = 'none'

export type ReadyGap = 'status' | 'points'

// What an item still lacks before it may enter a sprint. A story must be Ready. A story, task, or bug needs points.
// The PM can override the gate on the server, so this only explains the state.
export function readyGaps(issue: Pick<Issue, 'type' | 'status' | 'points'>): ReadyGap[] {
  const gaps: ReadyGap[] = []
  if (issue.type === 'story' && issue.status !== 'ready') gaps.push('status')
  if (issue.points === null) gaps.push('points')
  return gaps
}

export interface SprintTotals {
  items: number
  done: number
  points: number
  donePoints: number
}

export function sprintTotals(issues: Array<Pick<Issue, 'status' | 'points'>>): SprintTotals {
  const totals: SprintTotals = { items: issues.length, done: 0, points: 0, donePoints: 0 }
  for (const issue of issues) {
    totals.points += issue.points ?? 0
    if (statusCategory(issue.status) === 'done') {
      totals.done += 1
      totals.donePoints += issue.points ?? 0
    }
  }
  return totals
}

const DAY = 86_400_000

// Whole days from today to the end date, counted in UTC. It never goes below zero.
export function daysLeft(endsOn: string, today: Date): number {
  const end = Date.parse(`${endsOn}T00:00:00Z`)
  const start = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  return Number.isNaN(end) ? 0 : Math.max(0, Math.round((end - start) / DAY))
}

export function filterByEpic<T extends Pick<Issue, 'parentId'>>(issues: T[], epicId: string): T[] {
  if (epicId === '') return issues
  if (epicId === NO_EPIC) return issues.filter((issue) => issue.parentId === null)
  return issues.filter((issue) => issue.parentId === epicId)
}

// How many items each epic holds, and how many hold none.
export function epicCounts(
  epics: Array<Pick<Issue, 'id'>>,
  issues: Array<Pick<Issue, 'parentId'>>,
): { byEpic: Record<string, number>; withoutEpic: number } {
  const byEpic: Record<string, number> = Object.fromEntries(epics.map((epic) => [epic.id, 0]))
  let withoutEpic = 0
  for (const issue of issues) {
    if (issue.parentId === null) withoutEpic += 1
    else if (issue.parentId in byEpic) byEpic[issue.parentId] += 1
  }
  return { byEpic, withoutEpic }
}
