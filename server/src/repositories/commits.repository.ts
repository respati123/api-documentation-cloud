import type { SQL } from 'bun'
import { parseJson } from '@/lib/validation'

export interface CommitCursor {
  sortAt: string
  id: string
}

export interface CommitListRow {
  id: string
  parentIds: string[]
  message: string
  createdAt: Date
  authorEmail: string
  sortAt: string
}

export interface CommitRecord {
  id: string
  parentIds: string[]
  message: string
  snapshot: unknown
  createdAt: Date
}

// Ignores a commit whose id already exists, so a repeated push does not fail.
export async function insertCommit(db: SQL, commit: { id: string; workspaceId: string; authorId: string; parentIds: string[]; message: string; snapshot: unknown }): Promise<void> {
  await db`INSERT INTO commits (id, workspace_id, author_id, parent_ids, message, snapshot) VALUES (${commit.id}, ${commit.workspaceId}, ${commit.authorId}, ${JSON.stringify(commit.parentIds)}::jsonb, ${commit.message}, ${JSON.stringify(commit.snapshot)}::jsonb) ON CONFLICT (id) DO NOTHING`
}

// Newest first. `limit` is the number of rows to read. The caller asks for one more to learn whether a next page exists.
export async function listCommitsPage(db: SQL, query: { workspaceId: string; after: CommitCursor | null; limit: number }): Promise<CommitListRow[]> {
  const afterAt = query.after?.sortAt ?? null
  const afterId = query.after?.id ?? null
  const rows: Array<{ id: unknown; parentIds: unknown; message: unknown; createdAt: Date; authorEmail: unknown; sortAt: string }> = await db`SELECT * FROM (SELECT c.id, c.parent_ids AS "parentIds", c.message, c.created_at AS "createdAt", u.email AS "authorEmail", c.created_at::text AS "sortAt" FROM commits c JOIN users u ON u.id = c.author_id WHERE c.workspace_id = ${query.workspaceId}) q WHERE ${afterAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id::text) < (${afterAt}::timestamptz, ${afterId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${query.limit}`
  return rows.map((row) => ({
    id: String(row.id),
    parentIds: parseJson<string[]>(row.parentIds, []),
    message: String(row.message),
    createdAt: row.createdAt,
    authorEmail: String(row.authorEmail),
    sortAt: row.sortAt,
  }))
}

export async function findCommitInWorkspace(db: SQL, workspaceId: string, commitId: string): Promise<CommitRecord | undefined> {
  const [row] = await db`SELECT id, parent_ids AS "parentIds", message, snapshot, created_at AS "createdAt" FROM commits WHERE workspace_id = ${workspaceId} AND id = ${commitId}`
  return toRecord(row)
}

// Used by push to read the remote head. The head belongs to the workspace being pushed, so no workspace filter is needed.
export async function findCommitById(db: SQL, commitId: string): Promise<CommitRecord | undefined> {
  const [row] = await db`SELECT id, parent_ids AS "parentIds", message, snapshot, created_at AS "createdAt" FROM commits WHERE id = ${commitId}`
  return toRecord(row)
}

function toRecord(row: { id: unknown; parentIds: unknown; message: unknown; snapshot: unknown; createdAt: Date } | undefined): CommitRecord | undefined {
  if (!row) return undefined
  return {
    id: String(row.id),
    parentIds: parseJson<string[]>(row.parentIds, []),
    message: String(row.message),
    snapshot: parseJson<unknown>(row.snapshot, []),
    createdAt: row.createdAt,
  }
}
