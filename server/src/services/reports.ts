import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { burndown } from '@/models/sprint-report'
import {
  listClosedSprintTotals,
  listEventItems,
  listPointChanges,
  listScopeEvents,
  listSprintHeldItems,
  listStatusEventsOfSprint,
  type ReportItem,
} from '@/repositories/reports.repository'
import { findSprint, type SprintRow } from '@/repositories/sprints.repository'
import { type Actor, type IssueScope } from '@/services/issues'
import { resolveProjectRoles } from '@/services/project-roles'

async function sprintOf(db: SQL, scope: IssueScope, actor: Actor, sprintId: string): Promise<SprintRow> {
  await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const sprint = await findSprint(db, scope.projectId, sprintId)
  if (!sprint) throw new AppError('SPRINT_NOT_FOUND')
  return sprint
}

// The open points at the end of every day of the sprint, next to the ideal line.
export async function getBurndown(db: SQL, scope: IssueScope, actor: Actor, sprintId: string, today = new Date()) {
  const sprint = await sprintOf(db, scope, actor, sprintId)
  const [scopeEvents, statusEvents] = await Promise.all([listScopeEvents(db, sprint.id), listStatusEventsOfSprint(db, sprint.id)])
  const result = burndown({
    startsOn: sprint.startsOn,
    endsOn: sprint.endsOn,
    startedAt: sprint.startedAt,
    closedAt: sprint.closedAt,
    scope: scopeEvents,
    status: statusEvents,
    today,
  })
  return { sprintId: sprint.id, ...result }
}

const sum = (items: ReportItem[]) => items.reduce((total, item) => total + (item.points ?? 0), 0)

// What the sprint held, finished, left over, and how its scope moved after it started.
export async function getSprintReport(db: SQL, scope: IssueScope, actor: Actor, sprintId: string) {
  const sprint = await sprintOf(db, scope, actor, sprintId)
  const held = await listSprintHeldItems(db, sprint.id)
  const completed = held.filter((item) => item.status === 'done')
  const open = held.filter((item) => item.status !== 'done')
  const carried = await listEventItems(db, sprint.id, 'carried_over', false)
  const seen = new Set(open.map((item) => item.id))
  const notCompleted = [...open, ...carried.filter((item) => !seen.has(item.id))]
  const committed = (await listScopeEvents(db, sprint.id)).filter((event) => event.action === 'committed')

  return {
    sprint,
    committedPoints: committed.reduce((total, event) => total + (event.pointsAfter ?? 0), 0),
    completedPoints: sum(completed),
    completed,
    notCompleted,
    addedAfterStart: await listEventItems(db, sprint.id, 'added', true),
    removedAfterStart: await listEventItems(db, sprint.id, 'removed', true),
    pointsChanged: await listPointChanges(db, sprint.id),
  }
}

// Committed and completed points of the last closed sprints, oldest first, with the average completed.
export async function getVelocity(db: SQL, scope: IssueScope, actor: Actor, limit: number) {
  await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  const sprints = (await listClosedSprintTotals(db, scope.projectId, limit)).reverse()
  const average = sprints.length === 0 ? 0 : Math.round((sprints.reduce((total, sprint) => total + sprint.completedPoints, 0) / sprints.length) * 10) / 10
  return { sprints, averageCompleted: average }
}
