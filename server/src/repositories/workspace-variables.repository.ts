import type { SQL } from 'bun'
import { emptyWorkspaceVariables, parseJson } from '@/lib/validation'
import type { AuthUser, WorkspaceVariables } from '@/models/workspace'

export interface StoredVariables {
  variables: WorkspaceVariables
  revision: number
}

export async function findVariablesRow(db: SQL, workspaceId: string): Promise<StoredVariables | undefined> {
  const [row] = await db`SELECT variables::text AS "variables", revision FROM workspace_variables WHERE workspace_id = ${workspaceId}`
  if (!row) return undefined
  return { variables: parseJson<WorkspaceVariables>(row.variables, emptyWorkspaceVariables()), revision: Number(row.revision) }
}

// The head's snapshot text, or undefined when the workspace has no head.
export async function findHeadSnapshotText(db: SQL, workspaceId: string): Promise<string | undefined> {
  const [row] = await db`SELECT c.snapshot::text AS "snapshot" FROM workspaces w LEFT JOIN commits c ON c.id = w.head_commit_id AND c.workspace_id = w.id WHERE w.id = ${workspaceId}`
  return row?.snapshot == null ? undefined : String(row.snapshot)
}

// Writes the next revision only while the stored one is still the expected one. Returns false when another write got there first.
export async function writeVariablesRow(
  db: SQL,
  workspaceId: string,
  next: { variables: WorkspaceVariables; revision: number; user: AuthUser },
  expectedRevision: number,
): Promise<boolean> {
  const json = JSON.stringify(next.variables)
  if (expectedRevision === 0) {
    const inserted = await db`INSERT INTO workspace_variables (workspace_id, variables, revision, updated_by) VALUES (${workspaceId}, ${json}::text::jsonb, ${next.revision}, ${next.user.id}) ON CONFLICT (workspace_id) DO NOTHING RETURNING workspace_id`
    if (inserted.length > 0) return true
  }
  const updated = await db`UPDATE workspace_variables SET variables = ${json}::text::jsonb, revision = ${next.revision}, updated_by = ${next.user.id}, updated_at = now() WHERE workspace_id = ${workspaceId} AND revision = ${expectedRevision} RETURNING workspace_id`
  return updated.length > 0
}
