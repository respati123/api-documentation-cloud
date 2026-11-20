import type { SQL } from 'bun'

export interface UserInviteRow {
  id: string
  email: string
  expiresAt: Date
  createdAt: Date
  createdByEmail: string
  sortAt: string
}

export async function insertUserInvite(db: SQL, invite: { id: string; email: string; tokenHash: string; expiresAt: Date; createdBy: string }): Promise<void> {
  await db`INSERT INTO user_invites (id, email, token_hash, expires_at, created_by) VALUES (${invite.id}, ${invite.email}, ${invite.tokenHash}, ${invite.expiresAt}, ${invite.createdBy})`
}

export async function deletePendingUserInviteForEmail(db: SQL, email: string): Promise<void> {
  await db`DELETE FROM user_invites WHERE lower(email) = ${email} AND used_at IS NULL`
}

export async function listPendingUserInvites(db: SQL, query: { after: { sortAt: string; id: string } | null; limit: number }): Promise<UserInviteRow[]> {
  const afterAt = query.after?.sortAt ?? null
  const afterId = query.after?.id ?? null
  return db`SELECT * FROM (SELECT i.id, i.email, i.expires_at AS "expiresAt", i.created_at AS "createdAt", u.email AS "createdByEmail", i.created_at::text AS "sortAt" FROM user_invites i JOIN users u ON u.id = i.created_by WHERE i.used_at IS NULL AND i.expires_at > now()) q WHERE ${afterAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${afterAt}::timestamptz, ${afterId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${query.limit}`
}

export async function countPendingUserInvites(db: SQL): Promise<number> {
  const [row] = await db`SELECT count(*)::int AS total FROM user_invites WHERE used_at IS NULL AND expires_at > now()`
  return row.total
}

export async function deleteUserInvite(db: SQL, inviteId: string): Promise<void> {
  await db`DELETE FROM user_invites WHERE id = ${inviteId} AND used_at IS NULL`
}

export async function lockActiveUserInvite(db: SQL, tokenHash: string): Promise<{ id: string; email: string } | undefined> {
  const [row] = await db`SELECT id, email FROM user_invites WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now() FOR UPDATE`
  return row
}

export async function markUserInviteUsed(db: SQL, inviteId: string): Promise<void> {
  await db`UPDATE user_invites SET used_at = now() WHERE id = ${inviteId}`
}
