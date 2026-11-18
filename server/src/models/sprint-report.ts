export interface ScopeEvent {
  issueId: string
  action: 'committed' | 'added' | 'removed' | 'points_changed' | 'carried_over'
  pointsAfter: number | null
  afterStart: boolean
  at: Date
}

export interface StatusEvent {
  issueId: string
  toStatus: string
  at: Date
}

export interface BurndownInput {
  startsOn: string
  endsOn: string
  startedAt: Date | null
  closedAt: Date | null
  scope: ScopeEvent[]
  status: StatusEvent[]
  today: Date
}

export interface BurndownDay {
  date: string
  // The points still open at the end of that day. Null for a day that has not come, or after the sprint closed.
  remaining: number | null
  ideal: number
}

const DAY = 86_400_000

const dayOf = (time: Date | number) => new Date(time).toISOString().slice(0, 10)
const startOfDay = (date: string) => Date.parse(`${date}T00:00:00Z`)

// The open points at the end of every day of a sprint, from the events of its scope and the changes of status.
// The baseline is what was committed when the sprint started. An item counts while it is in the sprint and not done,
// with the points it had at that moment.
export function burndown(input: BurndownInput): { total: number; days: BurndownDay[] } {
  const total = input.startedAt
    ? input.scope.filter((event) => event.action === 'committed').reduce((sum, event) => sum + (event.pointsAfter ?? 0), 0)
    : remainingAt(input, input.today.getTime() + 1)

  const first = startOfDay(input.startsOn)
  const count = Math.max(1, Math.round((startOfDay(input.endsOn) - first) / DAY) + 1)
  const lastShown = dayOf(input.closedAt ?? input.today)

  const days: BurndownDay[] = Array.from({ length: count }, (_, index) => {
    const date = dayOf(first + index * DAY)
    const ideal = count === 1 ? 0 : Math.round(total * (1 - index / (count - 1)) * 100) / 100
    const shown = input.startedAt !== null && date <= lastShown
    return { date, remaining: shown ? remainingAt(input, first + (index + 1) * DAY) : null, ideal }
  })
  return { total, days }
}

// Open points of every item at one moment: events before it are applied in order.
function remainingAt(input: BurndownInput, before: number): number {
  const items = new Map<string, { member: boolean; points: number }>()
  const scope = input.scope.filter((event) => event.at.getTime() < before).sort((a, b) => a.at.getTime() - b.at.getTime())
  for (const event of scope) {
    const item = items.get(event.issueId) ?? { member: false, points: 0 }
    if (event.action === 'committed' || event.action === 'added') item.member = true
    // Carrying an item over happens as the sprint closes. It was not finished here, so it stays in what was left.
    if (event.action === 'removed') item.member = false
    if (event.action !== 'removed' && event.action !== 'carried_over') item.points = event.pointsAfter ?? 0
    items.set(event.issueId, item)
  }

  const done = new Map<string, boolean>()
  const statuses = input.status.filter((event) => event.at.getTime() < before).sort((a, b) => a.at.getTime() - b.at.getTime())
  for (const event of statuses) done.set(event.issueId, event.toStatus === 'done')

  let remaining = 0
  for (const [issueId, item] of items) if (item.member && !done.get(issueId)) remaining += item.points
  return remaining
}
