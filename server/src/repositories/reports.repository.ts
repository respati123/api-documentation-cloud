import type { SQL } from 'bun'
import type { ScopeEvent, StatusEvent } from '@/models/sprint-report'

export interface ReportItem {
  id: string
  key: string
  title: string
  type: string
  status: string | null
  points: number | null
}

const itemColumns = `i.id, p.key || '-' || i.number AS key, i.title, i.type, i.status, i.points`

export async function listScopeEvents(db: SQL, sprintId: string): Promise<ScopeEvent[]> {
  return db`SELECT issue_id AS "issueId", action, points_after AS "pointsAfter", after_start AS "afterStart", created_at AS at FROM sprint_scope_events WHERE sprint_id = ${sprintId} ORDER BY created_at, id`
}

// The status changes of the items that were ever in the sprint.
export async function listStatusEventsOfSprint(db: SQL, sprintId: string): Promise<StatusEvent[]> {
  return db`SELECT e.issue_id AS "issueId", e.to_status AS "toStatus", e.created_at AS at FROM issue_status_events e
    WHERE e.issue_id IN (SELECT DISTINCT issue_id FROM sprint_scope_events WHERE sprint_id = ${sprintId}) ORDER BY e.created_at, e.id`
}

export async function listSprintHeldItems(db: SQL, sprintId: string): Promise<ReportItem[]> {
  return db`SELECT ${db.unsafe(itemColumns)} FROM issues i JOIN projects p ON p.id = i.project_id WHERE i.sprint_id = ${sprintId} AND i.type IN ('story', 'task', 'bug') ORDER BY i.rank NULLS LAST, i.number`
}

// The items an event of one kind was written for, once each. `afterStartOnly` keeps what happened after the sprint started.
export async function listEventItems(db: SQL, sprintId: string, action: string, afterStartOnly: boolean): Promise<ReportItem[]> {
  return db`SELECT DISTINCT ON (i.id) ${db.unsafe(itemColumns)} FROM sprint_scope_events e JOIN issues i ON i.id = e.issue_id JOIN projects p ON p.id = i.project_id
    WHERE e.sprint_id = ${sprintId} AND e.action = ${action} AND (NOT ${afterStartOnly}::boolean OR e.after_start) ORDER BY i.id`
}

export async function listPointChanges(db: SQL, sprintId: string): Promise<Array<ReportItem & { before: number | null; after: number | null }>> {
  return db`SELECT ${db.unsafe(itemColumns)}, e.points_before AS before, e.points_after AS after FROM sprint_scope_events e JOIN issues i ON i.id = e.issue_id JOIN projects p ON p.id = i.project_id
    WHERE e.sprint_id = ${sprintId} AND e.action = 'points_changed' AND e.after_start ORDER BY e.created_at, e.id`
}

export interface SprintTotals {
  sprintId: string
  committedPoints: number
  addedPoints: number
  completedPoints: number
}

// Points of the last closed sprints. Completed counts the items that are done and stayed in the sprint.
export async function listClosedSprintTotals(db: SQL, projectId: string, limit: number): Promise<Array<SprintTotals & { name: string; startsOn: string; endsOn: string }>> {
  return db`SELECT s.id AS "sprintId", s.name, s.starts_on::text AS "startsOn", s.ends_on::text AS "endsOn",
      coalesce((SELECT sum(e.points_after) FROM sprint_scope_events e WHERE e.sprint_id = s.id AND e.action = 'committed'), 0)::int AS "committedPoints",
      coalesce((SELECT sum(e.points_after) FROM sprint_scope_events e WHERE e.sprint_id = s.id AND e.action = 'added' AND e.after_start), 0)::int AS "addedPoints",
      coalesce((SELECT sum(i.points) FROM issues i WHERE i.sprint_id = s.id AND i.status = 'done'), 0)::int AS "completedPoints"
    FROM sprints s WHERE s.project_id = ${projectId} AND s.status = 'closed' ORDER BY s.closed_at DESC LIMIT ${limit}`
}
