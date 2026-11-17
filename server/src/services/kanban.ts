import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { cumulativeFlow, cycleTimeDays, type FlowEvent, summarize, throughputPerDay, workItemAges } from '@/models/flow-metrics'
import { STORY_STATUSES, WORK_STATUSES } from '@/models/issue'
import { deleteWipLimit, listFlowEvents, listFlowItems, listWipLimitRows, upsertWipLimit } from '@/repositories/kanban.repository'
import { type Actor, isAgent, type IssueScope } from '@/services/issues'
import { resolveProjectRoles } from '@/services/project-roles'

const DAY = 86_400_000
const DEFAULT_DAYS = 30
const MIN_DAYS = 7
const MAX_DAYS = 90
const OLDEST_SHOWN = 10
const MAX_WIP_LIMIT = 100

// A status can carry a limit unless it is the end of the flow.
const LIMITED_STATUSES = new Set<string>([...STORY_STATUSES, ...WORK_STATUSES].filter((status) => status !== 'done'))

export async function listWipLimits(db: SQL, scope: IssueScope, actor: Actor): Promise<Array<{ status: string; limit: number }>> {
  await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  return listWipLimitRows(db, scope.projectId)
}

// A limit is a warning on a column and never blocks a card. The PM and the tech lead set it. Null removes it.
export async function setWipLimit(db: SQL, scope: IssueScope, actor: Actor, status: string, limit: number | null): Promise<Array<{ status: string; limit: number }>> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  if (!roles.isApprover) throw new AppError('ROLE_NOT_ALLOWED')
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  if (!LIMITED_STATUSES.has(status)) throw new AppError('PROJECT_INPUT_INVALID')
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > MAX_WIP_LIMIT)) throw new AppError('PROJECT_INPUT_INVALID')
  if (limit === null) await deleteWipLimit(db, scope.projectId, status)
  else await upsertWipLimit(db, scope.projectId, status, limit)
  return listWipLimitRows(db, scope.projectId)
}

// The Kanban numbers of a project over the last days: work in progress against its limits, throughput, cycle time,
// the age of what is still open, and the cumulative flow.
export async function getFlowMetrics(db: SQL, scope: IssueScope, actor: Actor, options: { days?: number } = {}, now = new Date()) {
  await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Number.isInteger(options.days) ? (options.days as number) : DEFAULT_DAYS))
  const [items, events, limits] = await Promise.all([listFlowItems(db, scope.projectId), listFlowEvents(db, scope.projectId), listWipLimitRows(db, scope.projectId)])

  const dates = Array.from({ length: days }, (_, index) => new Date(now.getTime() - (days - 1 - index) * DAY).toISOString().slice(0, 10))
  const windowStart = Date.parse(`${dates[0]}T00:00:00Z`)
  const perItem = new Map<string, FlowEvent[]>()
  for (const event of events) perItem.set(event.issueId, [...(perItem.get(event.issueId) ?? []), event])

  const finished = items.flatMap((item) => {
    const own = perItem.get(item.id) ?? []
    const last = own.at(-1)
    const time = cycleTimeDays(own)
    return last && time !== null && last.at.getTime() >= windowStart ? [time] : []
  })

  const openStatuses = [...new Set(items.filter((item) => item.status && item.status !== 'done').map((item) => item.status as string))]
  const limitOf = new Map(limits.map((row) => [row.status, row.limit]))
  const shown = [...new Set([...openStatuses, ...limits.map((row) => row.status)])].filter((status) => status !== 'todo' && status !== 'draft')
  const inProgress = shown.map((status) => {
    const count = items.filter((item) => item.status === status).length
    const limit = limitOf.get(status) ?? null
    return { status, count, limit, over: limit !== null && count > limit }
  })

  const ages = workItemAges(items, events, now)
  const titleOf = new Map(items.map((item) => [item.id, item]))
  const throughput = throughputPerDay(events, dates)

  return {
    days,
    wip: { total: inProgress.reduce((sum, column) => sum + column.count, 0), byStatus: inProgress },
    throughput: { perDay: throughput, total: throughput.reduce((sum, day) => sum + day.done, 0) },
    cycleTime: summarize(finished),
    workItemAge: {
      average: summarize(ages.map((age) => age.ageDays)).average,
      oldest: ages.slice(0, OLDEST_SHOWN).map((age) => ({ id: age.id, key: titleOf.get(age.id)?.key ?? '', title: titleOf.get(age.id)?.title ?? '', ageDays: age.ageDays })),
    },
    cumulativeFlow: cumulativeFlow(items, events, dates),
  }
}
