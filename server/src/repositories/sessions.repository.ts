import type { SQL } from 'bun'
import type { AuthUser } from '@/models/workspace'

export async function insertSession(db: SQL, session: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void> {
  await db`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${session.tokenHash}, ${session.userId}, ${session.expiresAt})`
}

// Only live sessions count. An expired row is treated the same as a missing one.
export async function findSessionUser(db: SQL, tokenHash: string): Promise<AuthUser | undefined> {
  const [row] = await db`SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ${tokenHash} AND s.expires_at > now()`
  return row
}

export async function deleteSession(db: SQL, tokenHash: string): Promise<void> {
  await db`DELETE FROM sessions WHERE token_hash = ${tokenHash}`
}

export async function deleteSessionsForUser(db: SQL, userId: string): Promise<void> {
  await db`DELETE FROM sessions WHERE user_id = ${userId}`
}
