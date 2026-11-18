import type { SQL } from 'bun'

export type SprintStatus = 'planned' | 'active' | 'closed'

export interface SprintRow {
  id: string
  projectId: string
  name: string
  goal: string
  startsOn: string
  endsOn: string
  status: SprintStatus
  startedAt: Date | null
  closedAt: Date | null
  createdBy: string
  createdAt: Date
}

const columns = `id, project_id AS "projectId", name, goal, starts_on::text AS "startsOn", ends_on::text AS "endsOn", status, started_at AS "startedAt", closed_at AS "closedAt", created_by AS "createdBy", created_at AS "createdAt"`

export async function insertSprint(
  db: SQL,
  input: { id: string; projectId: string; name: string; goal: string; startsOn: string; endsOn: string; createdBy: string },
): Promise<void> {
  await db`INSERT INTO sprints (id, project_id, name, goal, starts_on, ends_on, created_by) VALUES (${input.id}, ${input.projectId}, ${input.name}, ${input.goal}, ${input.startsOn}, ${input.endsOn}, ${input.createdBy})`
}

export async function findSprint(db: SQL, projectId: string, id: string): Promise<SprintRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(columns)} FROM sprints WHERE project_id = ${projectId} AND id = ${id}`
  return row
}

export async function listSprintRows(db: SQL, projectId: string): Promise<SprintRow[]> {
  return db`SELECT ${db.unsafe(columns)} FROM sprints WHERE project_id = ${projectId} ORDER BY starts_on, created_at`
}

export async function updateSprintFields(
  db: SQL,
  id: string,
  fields: { name?: string; goal?: string; startsOn?: string; endsOn?: string },
): Promise<void> {
  const row: Record<string, unknown> = {}
  if (fields.name !== undefined) row.name = fields.name
  if (fields.goal !== undefined) row.goal = fields.goal
  if (fields.startsOn !== undefined) row.starts_on = fields.startsOn
  if (fields.endsOn !== undefined) row.ends_on = fields.endsOn
  if (Object.keys(row).length === 0) return
  await db`UPDATE sprints SET ${db(row)} WHERE id = ${id}`
}

export async function startSprintRow(db: SQL, id: string): Promise<void> {
  await db`UPDATE sprints SET status = 'active', started_at = now() WHERE id = ${id}`
}

export async function closeSprintRow(db: SQL, id: string): Promise<void> {
  await db`UPDATE sprints SET status = 'closed', closed_at = now() WHERE id = ${id}`
}

export async function hasActiveSprint(db: SQL, projectId: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM sprints WHERE project_id = ${projectId} AND status = 'active'`
  return row !== undefined
}

export interface SprintItem {
  id: string
  status: string | null
  points: number | null
}

// The stories, tasks, and bugs in a sprint. Sub-tasks go along with their parent and are not listed.
export async function listSprintItems(db: SQL, sprintId: string): Promise<SprintItem[]> {
  return db`SELECT id, status, points FROM issues WHERE sprint_id = ${sprintId} AND type IN ('story', 'task', 'bug') ORDER BY rank NULLS LAST, number`
}

export async function setIssueSprint(db: SQL, issueId: string, sprintId: string | null): Promise<void> {
  await db`UPDATE issues SET sprint_id = ${sprintId}, updated_at = now() WHERE id = ${issueId}`
}

export type ScopeAction = 'committed' | 'added' | 'removed' | 'points_changed' | 'carried_over'

export async function insertScopeEvent(
  db: SQL,
  event: {
    id: string
    sprintId: string
    issueId: string
    action: ScopeAction
    pointsBefore: number | null
    pointsAfter: number | null
    afterStart: boolean
    overrideReason: string | null
    actorId: string
  },
): Promise<void> {
  await db`INSERT INTO sprint_scope_events (id, sprint_id, issue_id, action, points_before, points_after, after_start, override_reason, actor_id)
    VALUES (${event.id}, ${event.sprintId}, ${event.issueId}, ${event.action}, ${event.pointsBefore}, ${event.pointsAfter}, ${event.afterStart}, ${event.overrideReason}, ${event.actorId})`
}
