import type { SQL } from 'bun'
import type { Role } from '@/models/workspace'

export interface MemberCursor {
  rank: number
  sortAt: string
  id: string
}

export interface MemberRow {
  id: string
  email: string
  role: Role
  joinedAt: Date
  rank: number
  sortAt: string
}

export async function findRole(db: SQL, workspaceId: string, userId: string): Promise<Role | undefined> {
  const [row] = await db`SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
  return row?.role as Role | undefined
}

// Ignores a membership that already exists, so the role of an existing member is not changed.
export async function insertMembership(db: SQL, membership: { workspaceId: string; userId: string; role: Role }): Promise<void> {
  await db`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${membership.workspaceId}, ${membership.userId}, ${membership.role}) ON CONFLICT (workspace_id, user_id) DO NOTHING`
}

export async function updateRole(db: SQL, workspaceId: string, userId: string, role: Role): Promise<void> {
  await db`UPDATE memberships SET role = ${role} WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
}

export async function deleteMembership(db: SQL, workspaceId: string, userId: string): Promise<void> {
  await db`DELETE FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
}

export async function listMemberIds(db: SQL, workspaceId: string): Promise<string[]> {
  const rows: Array<{ userId: string }> = await db`SELECT user_id AS "userId" FROM memberships WHERE workspace_id = ${workspaceId}`
  return rows.map((row) => String(row.userId))
}

export async function hasMemberWithEmail(db: SQL, workspaceId: string, email: string): Promise<boolean> {
  const [row] = await db`SELECT 1 FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ${workspaceId} AND lower(u.email) = lower(${email})`
  return row !== undefined
}

// Orders owners first, then editors, then viewers, and joins in time order inside each group.
// `limit` is the number of rows to read. The caller asks for one more to learn whether a next page exists.
export async function listMembersPage(db: SQL, query: { workspaceId: string; after: MemberCursor | null; limit: number }): Promise<MemberRow[]> {
  const afterRank = query.after?.rank ?? null
  const afterAt = query.after?.sortAt ?? null
  const afterId = query.after?.id ?? null
  return db`SELECT * FROM (SELECT u.id, u.email, m.role, m.created_at AS "joinedAt", CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END AS rank, m.created_at::text AS "sortAt" FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ${query.workspaceId}) q WHERE ${afterRank}::int IS NULL OR (q.rank, q."sortAt"::timestamptz, q.id) > (${afterRank}::int, ${afterAt}::timestamptz, ${afterId}::text) ORDER BY q.rank, q."sortAt"::timestamptz, q.id LIMIT ${query.limit}`
}
