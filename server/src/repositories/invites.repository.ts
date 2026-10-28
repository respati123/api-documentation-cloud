import type { SQL } from 'bun'
import type { Role } from '@/models/workspace'

export interface InviteCursor {
  sortAt: string
  id: string
}

export interface InviteListRow {
  id: string
  email: string
  role: Role
  expiresAt: Date
  createdAt: Date
  createdByEmail: string
  sortAt: string
}

export async function insertInvite(db: SQL, invite: { id: string; workspaceId: string; email: string; tokenHash: string; role: Role; expiresAt: Date; createdBy: string }): Promise<void> {
  await db`INSERT INTO invites (id, workspace_id, email, token_hash, role, expires_at, created_by) VALUES (${invite.id}, ${invite.workspaceId}, ${invite.email}, ${invite.tokenHash}, ${invite.role}, ${invite.expiresAt}, ${invite.createdBy})`
}

// Replacing a pending invite keeps one live token per email. Used invites are kept as history.
export async function deleteUnusedInvitesForEmail(db: SQL, workspaceId: string, email: string): Promise<void> {
  await db`DELETE FROM invites WHERE workspace_id = ${workspaceId} AND lower(email) = ${email} AND used_at IS NULL`
}

// Newest first. `limit` is the number of rows to read. The caller asks for one more to learn whether a next page exists.
export async function listActiveInvites(db: SQL, query: { workspaceId: string; after: InviteCursor | null; limit: number }): Promise<InviteListRow[]> {
  const afterAt = query.after?.sortAt ?? null
  const afterId = query.after?.id ?? null
  return db`SELECT * FROM (SELECT i.id, i.email, i.role, i.expires_at AS "expiresAt", i.created_at AS "createdAt", u.email AS "createdByEmail", i.created_at::text AS "sortAt" FROM invites i JOIN users u ON u.id = i.created_by WHERE i.workspace_id = ${query.workspaceId} AND i.used_at IS NULL AND i.expires_at > now()) q WHERE ${afterAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${afterAt}::timestamptz, ${afterId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${query.limit}`
}

export async function deleteInvite(db: SQL, workspaceId: string, inviteId: string): Promise<void> {
  await db`DELETE FROM invites WHERE id = ${inviteId} AND workspace_id = ${workspaceId}`
}

// Locks the invite so one token cannot be accepted twice. Call it inside a transaction.
export async function lockActiveInvite(db: SQL, tokenHash: string): Promise<{ id: string; workspaceId: string; email: string | null; role: Role } | undefined> {
  const [row] = await db`SELECT id, workspace_id AS "workspaceId", email, role FROM invites WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now() FOR UPDATE`
  return row
}

export async function markInviteUsed(db: SQL, inviteId: string): Promise<void> {
  await db`UPDATE invites SET used_at = now() WHERE id = ${inviteId}`
}
