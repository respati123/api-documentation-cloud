import type { SQL } from 'bun'
import type { McpKeyRow } from '@/models/mcp'

const keyColumns = 'id, user_id AS "userId", name, key_suffix AS "keySuffix", expires_at AS "expiresAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt", created_at AS "createdAt"'

export interface McpKeyAuthRow {
  keyId: string
  userId: string
  guideVersion: string | null
  guideReadAt: Date | null
}

export interface AdminMcpKeyRow extends McpKeyRow {
  email: string
  sortAt: string
}

// The open-key count and the insert share one transaction, so two requests at once cannot pass the limit.
export async function insertMcpKeyWithinLimit(db: SQL, input: { id: string; userId: string; name: string; keyHash: string; keySuffix: string; expiresAt: Date | null; validDays: number | null; limit: number }): Promise<McpKeyRow | undefined> {
  return db.begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(hashtext(${`mcp_keys:${input.userId}`}))`
    const [count] = await tx`SELECT count(*)::int AS open FROM mcp_keys WHERE user_id = ${input.userId} AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`
    if (count.open >= input.limit) return undefined
    const [row] = await tx`INSERT INTO mcp_keys (id, user_id, created_by, name, key_hash, key_suffix, valid_days, expires_at, claimed_at) VALUES (${input.id}, ${input.userId}, ${input.userId}, ${input.name}, ${input.keyHash}, ${input.keySuffix}, ${input.validDays}, ${input.expiresAt}, now()) RETURNING ${tx.unsafe(keyColumns)}`
    return row as McpKeyRow
  })
}

// Keys still waiting for a claim from the old flow are left out: they were revoked when the flow went away.
export async function listUserMcpKeys(db: SQL, userId: string): Promise<McpKeyRow[]> {
  return db`SELECT ${db.unsafe(keyColumns)} FROM mcp_keys WHERE user_id = ${userId} AND claimed_at IS NOT NULL ORDER BY revoked_at IS NULL DESC, created_at DESC LIMIT 50`
}

export async function revokeUserMcpKey(db: SQL, userId: string, keyId: string): Promise<boolean> {
  const rows = await db`UPDATE mcp_keys SET revoked_at = now() WHERE id = ${keyId} AND user_id = ${userId} AND revoked_at IS NULL RETURNING id`
  return rows.length > 0
}

export async function revokeMcpKey(db: SQL, keyId: string): Promise<boolean> {
  const rows = await db`UPDATE mcp_keys SET revoked_at = now() WHERE id = ${keyId} AND revoked_at IS NULL RETURNING id`
  return rows.length > 0
}

export async function revokeMcpKeyWithoutMembership(db: SQL, userId: string): Promise<void> {
  await db`UPDATE mcp_keys SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = ${userId})`
}

export async function findMcpKeyAuth(db: SQL, keyHash: string): Promise<McpKeyAuthRow | undefined> {
  const [row] = await db`SELECT id AS "keyId", user_id AS "userId", guide_version AS "guideVersion", guide_read_at AS "guideReadAt" FROM mcp_keys WHERE key_hash = ${keyHash} AND claimed_at IS NOT NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`
  return row
}

export async function markGuideRead(db: SQL, keyId: string, version: string): Promise<void> {
  await db`UPDATE mcp_keys SET guide_version = ${version}, guide_read_at = now() WHERE id = ${keyId}`
}

export async function touchMcpKey(db: SQL, keyId: string): Promise<void> {
  await db`UPDATE mcp_keys SET last_used_at = now() WHERE id = ${keyId}`
}

// Every claimed key in the app with its owner's email, newest first. `limit` is one more than the page size.
export async function listAllMcpKeys(db: SQL, input: { query: string; after: { sortAt: string; id: string } | null; limit: number }): Promise<AdminMcpKeyRow[]> {
  const pattern = `%${input.query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
  const afterAt = input.after?.sortAt ?? null
  const afterId = input.after?.id ?? null
  return db`
    SELECT k.id, k.user_id AS "userId", k.name, k.key_suffix AS "keySuffix", k.expires_at AS "expiresAt", k.last_used_at AS "lastUsedAt", k.revoked_at AS "revokedAt", k.created_at AS "createdAt", u.email, k.created_at::text AS "sortAt"
    FROM mcp_keys k JOIN users u ON u.id = k.user_id
    WHERE k.claimed_at IS NOT NULL
      AND (u.email ILIKE ${pattern} OR k.name ILIKE ${pattern})
      AND (${afterAt}::text IS NULL OR (k.created_at, k.id) < (${afterAt}::timestamptz, ${afterId}::text))
    ORDER BY k.created_at DESC, k.id DESC
    LIMIT ${input.limit}`
}
