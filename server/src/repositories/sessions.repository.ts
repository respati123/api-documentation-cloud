import type { SQL } from 'bun'
import type { AuthUser } from '@/models/workspace'

export type SessionClient = 'web' | 'desktop'

export interface SessionRecord {
  id: string
  client: SessionClient
  device: string
  createdAt: Date
  lastUsedAt: Date
}

export async function insertSession(
  db: SQL,
  session: { id: string; tokenHash: string; userId: string; expiresAt: Date; client: SessionClient; device: string },
): Promise<void> {
  await db`INSERT INTO sessions (id, token_hash, user_id, expires_at, client, device) VALUES (${session.id}, ${session.tokenHash}, ${session.userId}, ${session.expiresAt}, ${session.client}, ${session.device})`
}

// Only live sessions count. An expired row is treated the same as a missing one.
export async function findSession(db: SQL, tokenHash: string): Promise<{ sessionId: string; user: AuthUser } | undefined> {
  const [row] = await db`SELECT s.id AS "sessionId", u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()`
  if (!row) return undefined
  return { sessionId: String(row.sessionId), user: { id: String(row.id), email: String(row.email) } }
}

export async function deleteSession(db: SQL, tokenHash: string): Promise<void> {
  await db`DELETE FROM sessions WHERE token_hash = ${tokenHash}`
}

export async function deleteSessionsForUser(db: SQL, userId: string): Promise<void> {
  await db`DELETE FROM sessions WHERE user_id = ${userId}`
}

export async function listLiveSessions(db: SQL, userId: string): Promise<SessionRecord[]> {
  const rows = await db`SELECT id, client, device, created_at AS "createdAt", last_used_at AS "lastUsedAt" FROM sessions WHERE user_id = ${userId} AND expires_at > now() ORDER BY created_at DESC`
  return rows.map((row: { id: unknown; client: unknown; device: unknown; createdAt: Date; lastUsedAt: Date }) => ({ id: String(row.id), client: row.client as SessionClient, device: String(row.device), createdAt: row.createdAt, lastUsedAt: row.lastUsedAt }))
}

// Removes one session, but only one that belongs to this user. Returns false when no such session exists for them.
export async function deleteSessionById(db: SQL, userId: string, sessionId: string): Promise<boolean> {
  const rows = await db`DELETE FROM sessions WHERE id = ${sessionId} AND user_id = ${userId} RETURNING id`
  return rows.length > 0
}
