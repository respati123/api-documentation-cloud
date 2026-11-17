import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'

export interface PlanningEventInput {
  workspaceId: string
  actorId: string
  apiKeyId: string | null
  targetKind: string
  targetId: string
  action: string
  details?: Record<string, unknown>
}

export interface PlanningEventRow {
  id: string
  actorId: string
  apiKeyId: string | null
  apiKeyName: string | null
  targetKind: string
  targetId: string
  action: string
  createdAt: Date
}

export async function insertPlanningEvent(db: SQL, input: PlanningEventInput): Promise<void> {
  await db`INSERT INTO planning_events (id, workspace_id, actor_id, api_key_id, api_key_name, target_kind, target_id, action, details) VALUES (${randomUUID()}, ${input.workspaceId}, ${input.actorId}, ${input.apiKeyId}, (SELECT name FROM mcp_keys WHERE id = ${input.apiKeyId}), ${input.targetKind}, ${input.targetId}, ${input.action}, (${JSON.stringify(input.details ?? {})}::text)::jsonb)`
}

export async function listPlanningEventRows(db: SQL, workspaceId: string, limit: number): Promise<PlanningEventRow[]> {
  return db`SELECT id, actor_id AS "actorId", api_key_id AS "apiKeyId", api_key_name AS "apiKeyName", target_kind AS "targetKind", target_id AS "targetId", action, created_at AS "createdAt" FROM planning_events WHERE workspace_id = ${workspaceId} ORDER BY created_at DESC LIMIT ${limit}`
}
