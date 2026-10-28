import type { SQL } from 'bun'

export async function deleteUnusedResets(db: SQL, userId: string): Promise<void> {
  await db`DELETE FROM password_resets WHERE user_id = ${userId} AND used_at IS NULL`
}

export async function insertReset(db: SQL, reset: { tokenHash: string; userId: string; expiresAt: Date }): Promise<void> {
  await db`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${reset.tokenHash}, ${reset.userId}, ${reset.expiresAt})`
}

// Locks the row so two reset requests with the same token cannot both succeed. Call it inside a transaction.
export async function lockActiveReset(db: SQL, tokenHash: string): Promise<string | undefined> {
  const [row] = await db`SELECT user_id AS "userId" FROM password_resets WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now() FOR UPDATE`
  return row?.userId
}

export async function markResetUsed(db: SQL, tokenHash: string): Promise<void> {
  await db`UPDATE password_resets SET used_at = now() WHERE token_hash = ${tokenHash}`
}
