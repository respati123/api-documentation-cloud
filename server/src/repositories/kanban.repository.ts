import type { SQL } from 'bun'
import type { FlowEvent, FlowItem } from '@/models/flow-metrics'

export interface FlowItemRow extends FlowItem {
  key: string
  title: string
}

const ITEM_CAP = 5000
const EVENT_CAP = 50_000

// The published stories, tasks, and bugs of a project. Their status is what the board shows.
export async function listFlowItems(db: SQL, projectId: string): Promise<FlowItemRow[]> {
  return db`SELECT i.id, p.key || '-' || i.number AS key, i.title, i.status, i.created_at AS "createdAt"
    FROM issues i JOIN projects p ON p.id = i.project_id
    WHERE i.project_id = ${projectId} AND i.type IN ('story', 'task', 'bug') AND i.published_at IS NOT NULL
    ORDER BY i.number LIMIT ${ITEM_CAP}`
}

export async function listFlowEvents(db: SQL, projectId: string): Promise<FlowEvent[]> {
  return db`SELECT e.issue_id AS "issueId", e.from_status AS "fromStatus", e.to_status AS "toStatus", e.created_at AS at
    FROM issue_status_events e JOIN issues i ON i.id = e.issue_id
    WHERE i.project_id = ${projectId} AND i.type IN ('story', 'task', 'bug') ORDER BY e.created_at, e.id LIMIT ${EVENT_CAP}`
}

export async function listWipLimitRows(db: SQL, projectId: string): Promise<Array<{ status: string; limit: number }>> {
  return db`SELECT status, wip_limit AS "limit" FROM project_wip_limits WHERE project_id = ${projectId} ORDER BY status`
}

export async function upsertWipLimit(db: SQL, projectId: string, status: string, limit: number): Promise<void> {
  await db`INSERT INTO project_wip_limits (project_id, status, wip_limit) VALUES (${projectId}, ${status}, ${limit}) ON CONFLICT (project_id, status) DO UPDATE SET wip_limit = EXCLUDED.wip_limit`
}

export async function deleteWipLimit(db: SQL, projectId: string, status: string): Promise<void> {
  await db`DELETE FROM project_wip_limits WHERE project_id = ${projectId} AND status = ${status}`
}
