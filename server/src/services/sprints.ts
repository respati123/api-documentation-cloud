import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { isBacklogItem, type IssueRow, statusCategory } from '@/models/issue'
import { findIssue } from '@/repositories/issues.repository'
import { findProjectSettings } from '@/repositories/project-settings.repository'
import {
  closeSprintRow,
  findSprint,
  hasActiveSprint,
  insertScopeEvent,
  insertSprint,
  listSprintItems,
  listSprintRows,
  type ScopeAction,
  setIssueSprint,
  type SprintRow,
  startSprintRow,
  updateSprintFields,
} from '@/repositories/sprints.repository'
import { type Actor, invalid, isAgent, type IssueScope, loadVisible, logEvent } from '@/services/issues'
import { type ProjectRoles, resolveProjectRoles } from '@/services/project-roles'

const MAX_DAYS = 28

export interface SprintInput {
  name: string
  goal?: string
  startsOn: string
  endsOn: string
}

const badSprint = () => new AppError('SPRINT_INPUT_INVALID')

// Sprints are planned and run by the PM and the tech lead. An AI agent key never touches them.
// A project that works in Kanban mode has no sprints, so every change to one is refused there.
async function manager(db: SQL, scope: IssueScope, actor: Actor): Promise<ProjectRoles> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  if (!roles.isApprover) throw new AppError('ROLE_NOT_ALLOWED')
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  if ((await findProjectSettings(db, scope.projectId))?.mode === 'kanban') throw new AppError('SPRINT_NOT_AVAILABLE')
  return roles
}

async function sprintOf(db: SQL, scope: IssueScope, sprintId: string): Promise<SprintRow> {
  const sprint = await findSprint(db, scope.projectId, sprintId)
  if (!sprint) throw new AppError('SPRINT_NOT_FOUND')
  return sprint
}

export async function listSprints(db: SQL, scope: IssueScope, actor: Actor): Promise<SprintRow[]> {
  await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  return listSprintRows(db, scope.projectId)
}

export async function createSprint(db: SQL, scope: IssueScope, actor: Actor, input: SprintInput): Promise<SprintRow> {
  await manager(db, scope, actor)
  const fields = validatedSprint(input)
  const id = randomUUID()
  await insertSprint(db, { id, projectId: scope.projectId, createdBy: actor.userId, ...fields })
  await logEvent(db, scope, actor, id, 'sprint.created', {})
  return sprintOf(db, scope, id)
}

export async function updateSprint(db: SQL, scope: IssueScope, actor: Actor, sprintId: string, patch: Partial<SprintInput>): Promise<SprintRow> {
  await manager(db, scope, actor)
  const sprint = await sprintOf(db, scope, sprintId)
  if (sprint.status === 'closed') throw new AppError('SPRINT_NOT_EDITABLE')
  const fields = validatedSprint({
    name: patch.name ?? sprint.name,
    goal: patch.goal ?? sprint.goal,
    startsOn: patch.startsOn ?? sprint.startsOn,
    endsOn: patch.endsOn ?? sprint.endsOn,
  })
  await updateSprintFields(db, sprint.id, fields)
  return sprintOf(db, scope, sprint.id)
}

// A story enters a sprint only when it is Ready and has points. A task or bug needs points. The PM may override the
// gate with a reason, and the reason is kept with the entry. A move to another planned sprint is one removal and one entry.
export async function addSprintItem(
  db: SQL,
  scope: IssueScope,
  actor: Actor,
  sprintId: string,
  issueRef: string,
  options: { overrideReason?: string } = {},
): Promise<void> {
  const roles = await manager(db, scope, actor)
  const sprint = await sprintOf(db, scope, sprintId)
  if (sprint.status === 'closed') throw new AppError('SPRINT_NOT_EDITABLE')
  const issue = await loadVisible(db, scope, actor, roles, issueRef)
  if (!isBacklogItem(issue.type) || !issue.publishedAt || (issue.status && statusCategory(issue.status) === 'done')) throw invalid()

  const missing = gateMisses(issue)
  const reason = options.overrideReason?.trim() ?? ''
  let overrideReason: string | null = null
  if (missing.length > 0) {
    if (reason === '') throw new AppError('SPRINT_ITEM_NOT_READY', { details: { missing } })
    if (!roles.isPm) throw new AppError('ROLE_NOT_ALLOWED')
    overrideReason = reason.slice(0, 500)
  }

  await db.begin(async (tx) => {
    const afterStart = sprint.status === 'active'
    if (issue.sprintId && issue.sprintId !== sprint.id) {
      const previous = await findSprint(tx, scope.projectId, issue.sprintId)
      if (previous && previous.status !== 'closed') await scopeEvent(tx, actor, previous.id, issue, 'removed', previous.status === 'active')
    }
    if (issue.sprintId !== sprint.id) {
      await setIssueSprint(tx, issue.id, sprint.id)
      await scopeEvent(tx, actor, sprint.id, issue, 'added', afterStart, overrideReason)
    }
    await logEvent(tx, scope, actor, issue.id, 'issue.sprint_added', { sprintId: sprint.id })
  })
}

export async function removeSprintItem(db: SQL, scope: IssueScope, actor: Actor, sprintId: string, issueRef: string): Promise<void> {
  const roles = await manager(db, scope, actor)
  const sprint = await sprintOf(db, scope, sprintId)
  if (sprint.status === 'closed') throw new AppError('SPRINT_NOT_EDITABLE')
  const issue = await loadVisible(db, scope, actor, roles, issueRef)
  if (issue.sprintId !== sprint.id) throw invalid()
  await db.begin(async (tx) => {
    await setIssueSprint(tx, issue.id, null)
    await scopeEvent(tx, actor, sprint.id, issue, 'removed', sprint.status === 'active')
    await logEvent(tx, scope, actor, issue.id, 'issue.sprint_removed', { sprintId: sprint.id })
  })
}

// Starting commits what the sprint holds. The points at that moment are the baseline of the burndown.
export async function startSprint(db: SQL, scope: IssueScope, actor: Actor, sprintId: string): Promise<SprintRow> {
  await manager(db, scope, actor)
  const sprint = await sprintOf(db, scope, sprintId)
  if (sprint.status !== 'planned') throw new AppError('SPRINT_NOT_EDITABLE')
  if (await hasActiveSprint(db, scope.projectId)) throw new AppError('SPRINT_ALREADY_ACTIVE')
  await db.begin(async (tx) => {
    await startSprintRow(tx, sprint.id).catch((error: unknown) => {
      // Two starts at the same moment pass the check above. The unique index lets only one through.
      if (String(error).includes('sprints_one_active_idx')) throw new AppError('SPRINT_ALREADY_ACTIVE')
      throw error
    })
    for (const item of await listSprintItems(tx, sprint.id)) {
      await insertScopeEvent(tx, {
        id: randomUUID(),
        sprintId: sprint.id,
        issueId: item.id,
        action: 'committed',
        pointsBefore: null,
        pointsAfter: item.points,
        afterStart: false,
        overrideReason: null,
        actorId: actor.userId,
      })
    }
    await logEvent(tx, scope, actor, sprint.id, 'sprint.started', {})
  })
  return sprintOf(db, scope, sprint.id)
}

// Closing moves every unfinished item to the next planned sprint or back to the backlog. Finished items stay.
export async function closeSprint(db: SQL, scope: IssueScope, actor: Actor, sprintId: string, options: { carryTo: string }): Promise<SprintRow> {
  await manager(db, scope, actor)
  const sprint = await sprintOf(db, scope, sprintId)
  if (sprint.status !== 'active') throw new AppError('SPRINT_NOT_EDITABLE')
  const target = await carryTarget(db, scope, sprint, options?.carryTo)

  await db.begin(async (tx) => {
    for (const item of await listSprintItems(tx, sprint.id)) {
      if (item.status && statusCategory(item.status) === 'done') continue
      const issue = (await findIssue(tx, scope.projectId, item.id)) as IssueRow
      await scopeEvent(tx, actor, sprint.id, issue, 'carried_over', true)
      await setIssueSprint(tx, issue.id, target?.id ?? null)
      if (target) await scopeEvent(tx, actor, target.id, issue, 'added', false)
    }
    await closeSprintRow(tx, sprint.id)
    await logEvent(tx, scope, actor, sprint.id, 'sprint.closed', { carryTo: target?.id ?? 'backlog' })
  })
  return sprintOf(db, scope, sprint.id)
}

async function carryTarget(db: SQL, scope: IssueScope, sprint: SprintRow, carryTo: unknown): Promise<SprintRow | null> {
  if (carryTo === 'backlog') return null
  if (typeof carryTo !== 'string' || carryTo === sprint.id) throw badSprint()
  const target = await findSprint(db, scope.projectId, carryTo)
  if (!target || target.status !== 'planned') throw badSprint()
  return target
}

function gateMisses(issue: IssueRow): string[] {
  const missing: string[] = []
  if (issue.type === 'story' && issue.status !== 'ready') missing.push('status')
  if (issue.points === null) missing.push('points')
  return missing
}

export const scopeEvent = (
  tx: SQL,
  actor: Actor,
  sprintId: string,
  issue: Pick<IssueRow, 'id' | 'points'>,
  action: ScopeAction,
  afterStart: boolean,
  overrideReason: string | null = null,
) =>
  insertScopeEvent(tx, {
    id: randomUUID(),
    sprintId,
    issueId: issue.id,
    action,
    pointsBefore: null,
    pointsAfter: issue.points,
    afterStart,
    overrideReason,
    actorId: actor.userId,
  })

function validatedSprint(input: SprintInput) {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const goal = (input.goal ?? '').trim()
  if (name.length < 1 || name.length > 100 || goal.length > 1000) throw badSprint()
  const days = daysBetween(input.startsOn, input.endsOn)
  if (days === null || days < 1 || days > MAX_DAYS) throw badSprint()
  return { name, goal, startsOn: input.startsOn, endsOn: input.endsOn }
}

function daysBetween(from: unknown, to: unknown): number | null {
  const pattern = /^\d{4}-\d{2}-\d{2}$/
  if (typeof from !== 'string' || typeof to !== 'string' || !pattern.test(from) || !pattern.test(to)) return null
  const start = Date.parse(from)
  const end = Date.parse(to)
  return Number.isNaN(start) || Number.isNaN(end) ? null : Math.round((end - start) / 86_400_000)
}
