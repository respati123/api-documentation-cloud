import { statusCategory } from '@/models/issue'

export interface FlowItem {
  id: string
  createdAt: Date
  status: string | null
}

export interface FlowEvent {
  issueId: string
  toStatus: string
  at: Date
}

type Category = 'todo' | 'in_progress' | 'done'

const DAY = 86_400_000

// A status this code has no word for counts as todo, so one odd row cannot break a report.
function categoryOf(status: string | null): Category {
  if (!status) return 'todo'
  try {
    return statusCategory(status)
  } catch {
    return 'todo'
  }
}

const byTime = (a: FlowEvent, b: FlowEvent) => a.at.getTime() - b.at.getTime()
const round = (value: number, places = 1) => Math.round(value * 10 ** places) / 10 ** places

function eventsOf(events: FlowEvent[]): Map<string, FlowEvent[]> {
  const map = new Map<string, FlowEvent[]>()
  for (const event of [...events].sort(byTime)) map.set(event.issueId, [...(map.get(event.issueId) ?? []), event])
  return map
}

// The first move out of todo. It is when the work started.
const startOf = (events: FlowEvent[]) => events.find((event) => categoryOf(event.toStatus) !== 'todo')

// How many items sit in each category at the end of every given day. An item counts from the day it was made.
export function cumulativeFlow(items: FlowItem[], events: FlowEvent[], days: string[]): Array<{ date: string; todo: number; in_progress: number; done: number }> {
  const history = eventsOf(events)
  return days.map((date) => {
    const end = Date.parse(`${date}T00:00:00Z`) + DAY
    const counts = { date, todo: 0, in_progress: 0, done: 0 }
    for (const item of items) {
      if (item.createdAt.getTime() >= end) continue
      const last = (history.get(item.id) ?? []).filter((event) => event.at.getTime() < end).at(-1)
      counts[last ? categoryOf(last.toStatus) : 'todo'] += 1
    }
    return counts
  })
}

// Days from the first move out of todo to the move that finished the item. Null when it is not done.
export function cycleTimeDays(itemEvents: FlowEvent[]): number | null {
  const sorted = [...itemEvents].sort(byTime)
  const last = sorted.at(-1)
  if (!last || categoryOf(last.toStatus) !== 'done') return null
  const start = startOf(sorted)
  return start ? round(Math.max(0, last.at.getTime() - start.at.getTime()) / DAY, 2) : null
}

// How long each unfinished item has been in progress, oldest first.
export function workItemAges(items: FlowItem[], events: FlowEvent[], now: Date): Array<{ id: string; ageDays: number }> {
  const history = eventsOf(events)
  return items
    .filter((item) => categoryOf(item.status) === 'in_progress')
    .map((item) => {
      const started = startOf(history.get(item.id) ?? [])?.at ?? item.createdAt
      return { id: item.id, ageDays: round(Math.max(0, now.getTime() - started.getTime()) / DAY, 1) }
    })
    .sort((a, b) => b.ageDays - a.ageDays)
}

// The items that reached done on each day, once each.
export function throughputPerDay(events: FlowEvent[], days: string[]): Array<{ date: string; done: number }> {
  const finished = new Map<string, Set<string>>()
  for (const event of events) {
    if (categoryOf(event.toStatus) !== 'done') continue
    const date = event.at.toISOString().slice(0, 10)
    finished.set(date, (finished.get(date) ?? new Set()).add(event.issueId))
  }
  return days.map((date) => ({ date, done: finished.get(date)?.size ?? 0 }))
}

export function summarize(values: number[]): { count: number; average: number; median: number; p85: number } {
  if (values.length === 0) return { count: 0, average: 0, median: 0, p85: 0 }
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
  return {
    count: sorted.length,
    average: round(sorted.reduce((sum, value) => sum + value, 0) / sorted.length),
    median: round(median),
    p85: round(sorted[Math.ceil(0.85 * sorted.length) - 1]),
  }
}
