import { createHash, randomBytes, randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { cursorText, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { defaultToolsFor, MCP_KEY_ROLES, MCP_TOOLS, type McpKeyRole, type McpKeyRow, type McpKeyStatus, type McpTool } from '@/models/mcp'
import { countMemberships } from '@/repositories/memberships.repository'
import { claimMcpKey, findLatestMcpKey, findMcpKeyById, listMcpKeyMembers, replaceOpenMcpKey, revokeMcpKey, revokeMcpKeyWithoutMembership } from '@/repositories/mcp-keys.repository'
import { findUserById } from '@/repositories/users.repository'
import { requireAdmin } from '@/services/admin'
import { sendMcpKeyEmail } from '@/services/mail'
import { notify } from '@/services/notifications'
import { GUIDE_VERSION, guideFor } from '@/services/mcp-guides'

const claimDays = 7
const dayMs = 24 * 60 * 60 * 1000
const memberKeyPath = '/settings/mcp'

export function mcpKeyHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function mcpKeyStatus(key: McpKeyRow, now = new Date()): McpKeyStatus {
  if (key.revokedAt) return 'revoked'
  if (!key.claimedAt) return key.claimExpiresAt > now ? 'pending' : 'claim_expired'
  return key.expiresAt && key.expiresAt > now ? 'active' : 'expired'
}

function keyView(key: McpKeyRow) {
  return {
    id: key.id,
    name: key.name,
    role: key.role,
    tools: key.tools,
    validDays: key.validDays,
    status: mcpKeyStatus(key),
    claimExpiresAt: key.claimExpiresAt,
    claimedAt: key.claimedAt,
    expiresAt: key.expiresAt,
    lastUsedAt: key.lastUsedAt,
    revokedAt: key.revokedAt,
    createdAt: key.createdAt,
  }
}

export function mcpToolMatrix() {
  return { tools: [...MCP_TOOLS], roles: Object.fromEntries(MCP_KEY_ROLES.map((role) => [role, defaultToolsFor(role)])) }
}

export async function listKeyMembersPage(db: SQL, adminId: string, query: string, limit: number, cursor: CursorKeys | null) {
  await requireAdmin(db, adminId)
  const rows = await listMcpKeyMembers(db, { query: query.trim().slice(0, 254), after: cursorText(cursor, 'e'), limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ e: row.email }))
  return { items: page.items.map((row) => ({ ...row, key: row.key ? keyView(row.key) : null })), nextCursor: page.nextCursor }
}

type IssueInput = { userId?: unknown; name?: unknown; role?: unknown; tools?: unknown; validDays?: unknown }

function readIssueInput(input: IssueInput): { userId: string; name: string; role: McpKeyRole; tools: McpTool[]; validDays: number } {
  const name = typeof input.name === 'string' ? input.name.trim() : ''
  const role = MCP_KEY_ROLES.find((value) => value === input.role)
  const validDays = input.validDays
  if (typeof input.userId !== 'string' || name.length < 1 || name.length > 80 || !role || typeof validDays !== 'number' || !Number.isInteger(validDays) || validDays < 1 || validDays > 365) throw new AppError('MCP_KEY_INPUT_INVALID')
  if (input.tools === undefined) return { userId: input.userId, name, role, tools: defaultToolsFor(role), validDays }
  if (!Array.isArray(input.tools) || input.tools.length < 1 || input.tools.some((tool) => !MCP_TOOLS.includes(tool as McpTool))) throw new AppError('MCP_KEY_INPUT_INVALID')
  return { userId: input.userId, name, role, tools: [...new Set(input.tools as McpTool[])], validDays }
}

export async function issueMcpKey(ctx: AppContext, adminId: string, input: IssueInput) {
  await requireAdmin(ctx.db, adminId)
  const values = readIssueInput(input)
  const member = await findUserById(ctx.db, values.userId)
  if (!member || (await countMemberships(ctx.db, member.id)) === 0) throw new AppError('MCP_KEY_MEMBER_INVALID')
  const key = await replaceOpenMcpKey(ctx.db, { id: randomUUID(), createdBy: adminId, claimExpiresAt: new Date(Date.now() + claimDays * dayMs), ...values })
  await notify(ctx.db, member.id, 'mcp_key_ready', memberKeyPath, { keyName: key.name })
  const emailSent = await sendClaimEmail(ctx, member.email, key.name)
  return { key: keyView(key), emailSent }
}

export async function reissueMcpKey(ctx: AppContext, adminId: string, keyId: string) {
  await requireAdmin(ctx.db, adminId)
  const old = await findMcpKeyById(ctx.db, keyId)
  if (!old) throw new AppError('MCP_KEY_NOT_FOUND')
  return issueMcpKey(ctx, adminId, { userId: old.userId, name: old.name, role: old.role, tools: old.tools, validDays: old.validDays })
}

export async function revokeMcpKeyAsAdmin(db: SQL, adminId: string, keyId: string): Promise<void> {
  await requireAdmin(db, adminId)
  if (!(await revokeMcpKey(db, keyId))) throw new AppError('MCP_KEY_NOT_FOUND')
}

export async function getMyMcpKey(db: SQL, userId: string) {
  const key = await findLatestMcpKey(db, userId)
  return key ? keyView(key) : null
}

// The secret exists only in this response. The database keeps its hash.
export async function claimMyMcpKey(db: SQL, userId: string, keyId: string) {
  const key = await findMcpKeyById(db, keyId)
  if (!key || key.userId !== userId) throw new AppError('MCP_KEY_NOT_FOUND')
  const secret = `apm_${randomBytes(32).toString('base64url')}`
  const claimed = await claimMcpKey(db, { keyId, userId, keyHash: mcpKeyHash(secret), expiresAt: new Date(Date.now() + key.validDays * dayMs) })
  if (!claimed) throw new AppError('MCP_KEY_CLAIM_UNAVAILABLE')
  return { secret, key: keyView(claimed) }
}

// The playbook the member's agent follows, for the role of the member's current key.
export async function getMyMcpGuide(db: SQL, userId: string) {
  const key = await findLatestMcpKey(db, userId)
  if (!key || key.revokedAt) return null
  return { role: key.role, version: GUIDE_VERSION, guide: guideFor(key.role) }
}

export async function revokeKeyIfNoWorkspace(db: SQL, userId: string): Promise<void> {
  await revokeMcpKeyWithoutMembership(db, userId)
}

async function sendClaimEmail(ctx: AppContext, to: string, keyName: string): Promise<boolean> {
  if (!ctx.config.smtp.host) return false
  try {
    await sendMcpKeyEmail(ctx.config, to, keyName, `${ctx.config.publicWebUrl}${memberKeyPath}`, claimDays)
    return true
  } catch (error) {
    ctx.logger.error('MCP key email delivery failed', { error })
    return false
  }
}
