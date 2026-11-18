import type { SQL } from 'bun'

export interface ProjectSettings {
  id: string
  name: string
  key: string
  mode: 'scrum' | 'kanban'
  productGoal: string
}

export async function findProjectSettings(db: SQL, projectId: string): Promise<ProjectSettings | undefined> {
  const [row] = await db`SELECT id, name, key, mode, product_goal AS "productGoal" FROM projects WHERE id = ${projectId}`
  return row
}

// The project that uses a key in a workspace, either as its current key or as an old one it gave up.
export async function keyOwner(db: SQL, workspaceId: string, key: string): Promise<string | undefined> {
  const [row] = await db`SELECT project_id AS "projectId" FROM (
      SELECT id AS project_id FROM projects WHERE workspace_id = ${workspaceId} AND key = ${key}
      UNION ALL
      SELECT project_id FROM project_key_aliases WHERE workspace_id = ${workspaceId} AND key = ${key}
    ) AS owners LIMIT 1`
  return row?.projectId
}

export async function updateProjectRow(db: SQL, projectId: string, fields: { key?: string; mode?: string; productGoal?: string }): Promise<void> {
  const row: Record<string, unknown> = {}
  if (fields.key !== undefined) row.key = fields.key
  if (fields.mode !== undefined) row.mode = fields.mode
  if (fields.productGoal !== undefined) row.product_goal = fields.productGoal
  if (Object.keys(row).length === 0) return
  await db`UPDATE projects SET ${db(row)}, updated_at = now() WHERE id = ${projectId}`
}

export async function insertKeyAlias(db: SQL, input: { workspaceId: string; key: string; projectId: string }): Promise<void> {
  await db`INSERT INTO project_key_aliases (workspace_id, key, project_id) VALUES (${input.workspaceId}, ${input.key}, ${input.projectId}) ON CONFLICT (workspace_id, key) DO NOTHING`
}

export async function deleteKeyAlias(db: SQL, workspaceId: string, key: string): Promise<void> {
  await db`DELETE FROM project_key_aliases WHERE workspace_id = ${workspaceId} AND key = ${key}`
}
