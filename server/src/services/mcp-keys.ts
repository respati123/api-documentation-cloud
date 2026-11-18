import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { isMcpRole, MCP_KEY_LIMIT, MCP_KEY_ROLES, MCP_KEY_VALID_DAYS, MCP_TOOLS, defaultToolsFor, toolsForRoles, type McpKeyRow, type McpKeyStatus } from '@/models/mcp'
import { insertMcpKeyWithinLimit, listAllMcpKeys, listUserMcpKeys, revokeMcpKey, revokeMcpKeyWithoutMembership, revokeUserMcpKey } from '@/repositories/mcp-keys.repository'
import { listUserRolesByWorkspace } from '@/repositories/projects.repository'
import { requireAdmin } from '@/services/admin'
import { GUIDE_VERSION, guideFor } from '@/services/mcp-guides'

const dayMs = 24 * 60 * 60 * 1000

export function mcpKeyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function mcpKeyStatus(key: McpKeyRow, now = new Date()): McpKeyStatus {
  if (key.revokedAt) return 'revoked'
  return !key.expiresAt || key.expiresAt > now ? 'active' : 'expired'
}

function keyView(key: McpKeyRow) {
  return {
    id: key.id,
    name: key.name,
    keySuffix: key.keySuffix,
    status: mcpKeyStatus(key),
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
  }
}

export function mcpToolMatrix() {
  return { tools: [...MCP_TOOLS], roles: Object.fromEntries(MCP_KEY_ROLES.map((role) => [role, defaultToolsFor(role)])) }
}

export async function listMyMcpKeys(db: SQL, userId: string) {
  return { keys: (await listUserMcpKeys(db, userId)).map(keyView), limit: MCP_KEY_LIMIT }
}

function readCreateInput(input: { name?: unknown; validDays?: unknown }): { name: string; validDays: number | null } {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const validDays = input.validDays === null ? null : (MCP_KEY_VALID_DAYS as readonly unknown[]).includes(input.validDays) ? (input.validDays as number) : undefined
  if (name.length < 1 || name.length > 80 || validDays === undefined) throw new AppError('MCP_KEY_INPUT_INVALID')
  return { name, validDays }
}

// The secret exists only in this response. The database keeps its hash and its last four characters.
export async function createMyMcpKey(db: SQL, userId: string, input: { name?: unknown; validDays?: unknown }) {
  const { name, validDays } = readCreateInput(input)
  const secret = `apm_${randomBytes(32).toString('base64url')}`
  const key = await insertMcpKeyWithinLimit(db, {
    id: randomUUID(),
    userId,
    name,
    keyHash: mcpKeyHash(secret),
    keySuffix: secret.slice(-4),
    validDays,
    expiresAt: validDays === null ? null : new Date(Date.now() + validDays * dayMs),
    limit: MCP_KEY_LIMIT,
  })
  if (!key) throw new AppError('MCP_KEY_LIMIT_REACHED')
  return { secret, key: keyView(key) }
}

export async function revokeMyMcpKey(db: SQL, userId: string, keyId: string): Promise<void> {
  if (!(await revokeUserMcpKey(db, userId, keyId))) throw new AppError('MCP_KEY_NOT_FOUND')
}

// What each of the member's keys may do, per workspace. The same for every key, because access follows the roles.
export async function getMyMcpAccess(db: SQL, userId: string) {
  const workspaces = await listUserRolesByWorkspace(db, userId)
  return workspaces.map((workspace) => ({ ...workspace, tools: toolsForRoles(workspace.roles) }))
}

// The playbook the member's agent follows, for every role the member holds in any workspace.
export async function getMyMcpGuide(db: SQL, userId: string) {
  const roles = [...new Set((await listUserRolesByWorkspace(db, userId)).flatMap((workspace) => workspace.roles))].filter(isMcpRole)
  return { roles, version: GUIDE_VERSION, guide: guideFor(roles) }
}

export async function listAllMcpKeysPage(db: SQL, adminId: string, query: string, limit: number, cursor: CursorKeys | null) {
  await requireAdmin(db, adminId)
  const after = cursorValues(cursor, ['sortAt', 'id'])
  const rows = await listAllMcpKeys(db, { query: query.trim().slice(0, 254), after, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ sortAt: row.sortAt, id: row.id }))
  return { items: page.items.map((row) => ({ ...keyView(row), owner: { id: row.userId, email: row.email } })), nextCursor: page.nextCursor }
}

export async function revokeMcpKeyAsAdmin(db: SQL, adminId: string, keyId: string): Promise<void> {
  await requireAdmin(db, adminId)
  if (!(await revokeMcpKey(db, keyId))) throw new AppError('MCP_KEY_NOT_FOUND')
}

export async function revokeKeyIfNoWorkspace(db: SQL, userId: string): Promise<void> {
  await revokeMcpKeyWithoutMembership(db, userId)
}
