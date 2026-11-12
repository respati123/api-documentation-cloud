import type { SQL } from 'bun'
import type { McpKeyRole, McpKeyRow, McpPrincipal, McpTool } from '@/models/mcp'

const keyColumns = 'id, user_id AS "userId", created_by AS "createdBy", name, role, tools, valid_days AS "validDays", claim_expires_at AS "claimExpiresAt", claimed_at AS "claimedAt", expires_at AS "expiresAt", last_used_at AS "lastUsedAt", revoked_at AS "revokedAt", created_at AS "createdAt"'

export interface McpKeyMemberRow {
  userId: string
  email: string
  workspaceCount: number
  key: McpKeyRow | null
}

// A member has at most one open key, so the old one is revoked in the same transaction as the insert.
export async function replaceOpenMcpKey(db: SQL, input: { id: string; userId: string; createdBy: string; name: string; role: McpKeyRole; tools: McpTool[]; validDays: number; claimExpiresAt: Date }): Promise<McpKeyRow> {
  return db.begin(async (tx) => {
    await tx`UPDATE mcp_keys SET revoked_at = now() WHERE user_id = ${input.userId} AND revoked_at IS NULL`
    const [row] = await tx`INSERT INTO mcp_keys (id, user_id, created_by, name, role, tools, valid_days, claim_expires_at) VALUES (${input.id}, ${input.userId}, ${input.createdBy}, ${input.name}, ${input.role}, ARRAY(SELECT jsonb_array_elements_text((${JSON.stringify(input.tools)}::text)::jsonb)), ${input.validDays}, ${input.claimExpiresAt}) RETURNING ${tx.unsafe(keyColumns)}`
    return row as McpKeyRow
  })
}

export async function findOpenMcpKey(db: SQL, userId: string): Promise<McpKeyRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(keyColumns)} FROM mcp_keys WHERE user_id = ${userId} AND revoked_at IS NULL`
  return row
}

export async function findLatestMcpKey(db: SQL, userId: string): Promise<McpKeyRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(keyColumns)} FROM mcp_keys WHERE user_id = ${userId} ORDER BY revoked_at IS NULL DESC, created_at DESC LIMIT 1`
  return row
}

export async function findMcpKeyById(db: SQL, keyId: string): Promise<McpKeyRow | undefined> {
  const [row] = await db`SELECT ${db.unsafe(keyColumns)} FROM mcp_keys WHERE id = ${keyId}`
  return row
}

export async function claimMcpKey(db: SQL, input: { keyId: string; userId: string; keyHash: string; expiresAt: Date }): Promise<McpKeyRow | undefined> {
  const [row] = await db`UPDATE mcp_keys SET key_hash = ${input.keyHash}, claimed_at = now(), expires_at = ${input.expiresAt} WHERE id = ${input.keyId} AND user_id = ${input.userId} AND claimed_at IS NULL AND revoked_at IS NULL AND claim_expires_at > now() RETURNING ${db.unsafe(keyColumns)}`
  return row
}

export async function revokeMcpKey(db: SQL, keyId: string): Promise<boolean> {
  const rows = await db`UPDATE mcp_keys SET revoked_at = now() WHERE id = ${keyId} AND revoked_at IS NULL RETURNING id`
  return rows.length > 0
}

export async function revokeMcpKeyWithoutMembership(db: SQL, userId: string): Promise<void> {
  await db`UPDATE mcp_keys SET revoked_at = now() WHERE user_id = ${userId} AND revoked_at IS NULL AND NOT EXISTS (SELECT 1 FROM memberships WHERE user_id = ${userId})`
}

export async function findMcpPrincipal(db: SQL, keyHash: string): Promise<McpPrincipal | undefined> {
  const [row] = await db`SELECT id AS "keyId", user_id AS "userId", role, tools, guide_version AS "guideVersion", guide_read_at AS "guideReadAt" FROM mcp_keys WHERE key_hash = ${keyHash} AND claimed_at IS NOT NULL AND revoked_at IS NULL AND expires_at > now()`
  return row
}

export async function markGuideRead(db: SQL, keyId: string, version: string): Promise<void> {
  await db`UPDATE mcp_keys SET guide_version = ${version}, guide_read_at = now() WHERE id = ${keyId}`
}

export async function touchMcpKey(db: SQL, keyId: string): Promise<void> {
  await db`UPDATE mcp_keys SET last_used_at = now() WHERE id = ${keyId}`
}

// Members of at least one workspace, by email, each with the open key or else the latest revoked one.
export async function listMcpKeyMembers(db: SQL, input: { query: string; after: string | null; limit: number }): Promise<McpKeyMemberRow[]> {
  const pattern = `%${input.query.replace(/[\\%_]/g, (match) => `\\${match}`)}%`
  const rows = await db`
    SELECT u.id AS "userId", u.email, (SELECT count(*)::int FROM memberships m WHERE m.user_id = u.id) AS "workspaceCount", to_jsonb(k) AS key
    FROM users u
    LEFT JOIN LATERAL (SELECT ${db.unsafe(keyColumns)} FROM mcp_keys WHERE user_id = u.id ORDER BY revoked_at IS NULL DESC, created_at DESC LIMIT 1) k ON true
    WHERE EXISTS (SELECT 1 FROM memberships m WHERE m.user_id = u.id)
      AND u.email ILIKE ${pattern}
      AND (${input.after}::text IS NULL OR u.email > ${input.after})
    ORDER BY u.email
    LIMIT ${input.limit}`
  return rows.map((row: { userId: string; email: string; workspaceCount: number; key: Record<string, unknown> | null }) => ({ ...row, key: row.key ? keyFromJson(row.key) : null }))
}

function dateOrNull(value: unknown): Date | null {
  return typeof value === 'string' ? new Date(value) : null
}

function keyFromJson(json: Record<string, unknown>): McpKeyRow {
  return {
    ...(json as unknown as McpKeyRow),
    claimExpiresAt: new Date(String(json.claimExpiresAt)),
    claimedAt: dateOrNull(json.claimedAt),
    expiresAt: dateOrNull(json.expiresAt),
    lastUsedAt: dateOrNull(json.lastUsedAt),
    revokedAt: dateOrNull(json.revokedAt),
    createdAt: new Date(String(json.createdAt)),
  }
}
