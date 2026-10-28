import type { SQL } from 'bun'
import type { Role } from '@/models/workspace'

export interface WorkspaceCursor {
  sortAt: string
  id: string
}

export interface WorkspaceListRow {
  id: string
  name: string
  role: Role
  headCommitId: string | null
  createdAt: Date
  updatedAt: Date | null
  sortAt: string
}

export interface WorkspaceMemberRow {
  id: string
  name: string
  role: Role
  headCommitId: string | null
  createdAt: Date
  updatedAt: Date | null
}

export interface WorkspaceSnapshotRow {
  id: string
  name: string
  role: Role
  headCommitId: string | null
  parentIds: unknown
  message: string | null
  snapshot: unknown
  createdAt: Date | null
}

export async function insertWorkspace(db: SQL, workspace: { id: string; name: string; ownerId: string; headCommitId: string }): Promise<void> {
  await db`INSERT INTO workspaces (id, name, owner_id, head_commit_id) VALUES (${workspace.id}, ${workspace.name}, ${workspace.ownerId}, ${workspace.headCommitId})`
}

// `after` is the last row of the previous page. Rows are newest first, by the head commit's time.
// `limit` is the number of rows to read. The caller asks for one more to learn whether a next page exists.
export async function listWorkspacesPage(db: SQL, query: { userId: string; after: WorkspaceCursor | null; limit: number }): Promise<WorkspaceListRow[]> {
  const afterAt = query.after?.sortAt ?? null
  const afterId = query.after?.id ?? null
  return db`SELECT * FROM (SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", w.created_at AS "createdAt", c.created_at AS "updatedAt", COALESCE(c.created_at, w.created_at)::text AS "sortAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE m.user_id = ${query.userId}) q WHERE ${afterAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${afterAt}::timestamptz, ${afterId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${query.limit}`
}

export async function findWorkspaceForMember(db: SQL, workspaceId: string, userId: string): Promise<WorkspaceMemberRow | undefined> {
  const [row] = await db`SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", w.created_at AS "createdAt", c.created_at AS "updatedAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE w.id = ${workspaceId} AND m.user_id = ${userId}`
  return row
}

// The head commit's parents, message, and snapshot, for the pull response.
export async function findWorkspaceSnapshotRow(db: SQL, workspaceId: string, userId: string): Promise<WorkspaceSnapshotRow | undefined> {
  const [row] = await db`SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", c.parent_ids AS "parentIds", c.message, c.snapshot, c.created_at AS "createdAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE w.id = ${workspaceId} AND m.user_id = ${userId}`
  return row
}

export async function findWorkspaceSummary(db: SQL, workspaceId: string): Promise<{ id: string; name: string; headCommitId: string | null } | undefined> {
  const [row] = await db`SELECT id, name, head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${workspaceId}`
  return row
}

// Locks the head so two pushes or restores cannot move it at the same time. Call it inside a transaction.
export async function lockWorkspaceHead(db: SQL, workspaceId: string): Promise<{ headCommitId: string | null } | undefined> {
  const [row] = await db`SELECT head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`
  return row
}

export async function setWorkspaceHead(db: SQL, workspaceId: string, commitId: string): Promise<void> {
  await db`UPDATE workspaces SET head_commit_id = ${commitId} WHERE id = ${workspaceId}`
}

export async function renameWorkspace(db: SQL, workspaceId: string, name: string): Promise<void> {
  await db`UPDATE workspaces SET name = ${name} WHERE id = ${workspaceId}`
}

export async function deleteWorkspace(db: SQL, workspaceId: string): Promise<void> {
  await db`DELETE FROM workspaces WHERE id = ${workspaceId}`
}
