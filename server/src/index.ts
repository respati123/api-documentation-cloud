import { randomBytes, randomUUID, createHash } from 'node:crypto'
import { SQL } from 'bun'
import nodemailer from 'nodemailer'
import { loadConfig } from '@/config'
import { runMigrations } from '@/migrate'
import { created, noContent, ok } from '@/lib/http'
import { AppError } from '@/lib/errors/app-error'
import { cursorText, decodeCursor, encodeCursor, pageOf, readLimit } from '@/lib/pagination'
import { negotiateLocale } from '@/lib/locale'
import { createLogger } from '@/lib/logger'
import { routeLabel } from '@/lib/route-label'
import { errorResponse } from '@/middleware/error-response'
import { RateLimiter } from '@/middleware/rate-limit'
import { runWithRequestId } from '@/lib/request-context'
import { resolveRequestId } from '@/middleware/request-id'
import { isSensitivePath, withResponseHeaders } from '@/middleware/response-headers'

type Role = 'owner' | 'editor' | 'viewer'
type BodyMode = 'form-data' | 'urlencoded' | 'graphql' | 'json' | 'xml' | 'yaml' | 'edn' | 'text' | 'other' | 'file' | 'none'
type BodyField = { id: string; name: string; value: string; enabled: boolean; type: 'text' | 'file'; filePath?: string; fileName?: string }
type HeaderField = { id: string; name: string; value: string; enabled: boolean; description?: string }
type ParamField = { id: string; name: string; value: string; enabled: boolean; description?: string }
type RequestAuth = { type: 'none' } | { type: 'bearer'; token: string } | { type: 'basic'; username: string; password: string } | { type: 'api-key'; name: string; value: string; location: 'header' | 'query' }
type WorkspaceVariable = { id: string; name: string; value: string; secret: boolean }
type WorkspaceEnvironment = { id: string; name: string; variables: WorkspaceVariable[] }
type WorkspaceVariables = { globals: WorkspaceVariable[]; environments: WorkspaceEnvironment[] }
type TreeNode =
  | { id: string; kind: 'folder'; name: string; children: TreeNode[] }
  | { id: string; kind: 'request'; name: string; method: string; url: string; body: string; bodyMode?: BodyMode; bodyFields?: BodyField[]; bodyVariables?: string; bodyMimeType?: string; bodyPath?: string; bodyFileName?: string; headers?: HeaderField[]; params?: ParamField[]; auth?: RequestAuth; documentation?: string; deprecated?: boolean; deprecationReason?: string }
type AuthUser = { id: string; email: string }
type SyncSocketData = { userId: string }
type SyncSocketTicket = { userId: string; expiresAt: number }

const config = loadConfig()
const logger = createLogger({ level: config.logLevel, service: 'api', version: config.appVersion })
const db = new SQL(config.databaseUrl)
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000
const syncSocketTickets = new Map<string, SyncSocketTicket>()
const syncSockets = new Set<Bun.ServerWebSocket<SyncSocketData>>()
const desktopLoginCodes = new Map<string, { userId: string; expiresAt: number }>()
const limiter = new RateLimiter()

function tokenHash(token: string): string { return createHash('sha256').update(token).digest('hex') }
function clientAddress(request: Request): string {
  return request.headers.get('cf-connecting-ip')?.trim() || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
function enforceLimit(key: string, limit: number, windowMs: number) {
  if (!limiter.hit(key, limit, windowMs)) throw new AppError('RATE_LIMITED')
}
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
}
function createMailer() {
  const { host, port, secure, user, password } = config.smtp
  if (!host) throw new Error('SMTP_HOST is not configured.')
  return nodemailer.createTransport({
    host,
    port,
    secure,
    ...(user && password ? { auth: { user, pass: password } } : {})
  })
}
async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  await createMailer().sendMail({
    from: config.smtp.from,
    to,
    subject: 'Reset your API Documentation password',
    text: `We received a request to reset the password for your account.\n\nOpen this link to choose a new password. It expires in 1 hour:\n${resetUrl}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>We received a request to reset the password for your account.</p><p><a href="${escapeHtml(resetUrl)}">Choose a new password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`
  })
}
async function sendInviteEmail(to: string, workspaceName: string, role: 'editor' | 'viewer', inviterEmail: string, inviteUrl: string): Promise<void> {
  const transporter = createMailer()
  const safeWorkspaceName = escapeHtml(workspaceName)
  const safeRole = escapeHtml(role)
  const safeInviterEmail = escapeHtml(inviterEmail)
  const safeInviteUrl = escapeHtml(inviteUrl)
  await transporter.sendMail({
    from: config.smtp.from,
    to,
    subject: `Invitation to ${workspaceName}`,
    text: `${inviterEmail} invited you to join ${workspaceName} with the ${role} role.\n\nThis invitation expires in 7 days. Open the API Documentation desktop app and use this invitation link:\n${inviteUrl}`,
    html: `<p><strong>${safeInviterEmail}</strong> invited you to join <strong>${safeWorkspaceName}</strong> with the <strong>${safeRole}</strong> role.</p><p>This invitation expires in 7 days.</p><p><a href="${safeInviteUrl}">Open invitation in API Documentation</a></p><p>If the link does not open the app, copy this link into the app's invitation field:<br><code>${safeInviteUrl}</code></p>`
  })
}
function isAllowedSyncOrigin(origin: string | null): boolean {
  if (!origin || origin === 'null' || origin === 'file://') return true
  try {
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch { return false }
}
function isRecord(value: unknown): value is Record<string, unknown> { return !!value && typeof value === 'object' && !Array.isArray(value) }
function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== 'string') return (value ?? fallback) as T
  try { return JSON.parse(value) as T } catch { return fallback }
}

function emptyWorkspaceVariables(): WorkspaceVariables { return { globals: [], environments: [] } }

function sanitizeWorkspaceVariables(value: WorkspaceVariables): WorkspaceVariables {
  const cleanRows = (rows: WorkspaceVariable[]) => rows.map(({ id, name, value: variableValue, secret }) => ({ id, name, value: variableValue, secret }))
  return {
    globals: cleanRows(value.globals),
    environments: value.environments.map(({ id, name, variables }) => ({ id, name, variables: cleanRows(variables) }))
  }
}

function validateWorkspaceVariables(value: unknown): value is WorkspaceVariables {
  if (!isRecord(value) || !Array.isArray(value.globals) || !Array.isArray(value.environments) || value.globals.length > 500 || value.environments.length > 100) return false
  const ids = new Set<string>()
  let count = 0
  function validVariable(item: unknown): item is WorkspaceVariable {
    if (!isRecord(item) || ++count > 2000 || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string' || item.name.length > 160 || typeof item.value !== 'string' || item.value.length > 65536 || typeof item.secret !== 'boolean') return false
    if (item.secret && item.value !== '') return false
    ids.add(item.id)
    return true
  }
  if (!value.globals.every(validVariable)) return false
  return value.environments.every((item) => {
    if (!isRecord(item) || typeof item.id !== 'string' || !item.id || ids.has(item.id) || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 100 || !Array.isArray(item.variables) || item.variables.length > 500) return false
    ids.add(item.id)
    return item.variables.every(validVariable)
  })
}

function parseSnapshot(value: unknown): { tree: TreeNode[]; variables: WorkspaceVariables } {
  if (Array.isArray(value)) return { tree: value as TreeNode[], variables: emptyWorkspaceVariables() }
  if (!isRecord(value) || !validateTree(value.tree)) return { tree: [], variables: emptyWorkspaceVariables() }
  const variables = value.variables === undefined ? emptyWorkspaceVariables() : value.variables
  return validateWorkspaceVariables(variables) ? { tree: value.tree, variables: sanitizeWorkspaceVariables(variables) } : { tree: value.tree, variables: emptyWorkspaceVariables() }
}

function validateTree(value: unknown): value is TreeNode[] {
  if (!Array.isArray(value) || value.length > 1000) return false
  let count = 0
  const ids = new Set<string>()
  function valid(node: unknown, depth: number): node is TreeNode {
    if (!isRecord(node) || depth > 30 || ++count > 10000 || typeof node.id !== 'string' || ids.has(node.id) || typeof node.name !== 'string' || node.name.trim().length > 160) return false
    ids.add(node.id)
    if (node.kind === 'folder') return Array.isArray(node.children) && node.children.length <= 1000 && node.children.every((child) => valid(child, depth + 1))
    if (node.kind !== 'request' || typeof node.method !== 'string' || typeof node.url !== 'string' || typeof node.body !== 'string') return false
    if (node.documentation !== undefined && (typeof node.documentation !== 'string' || node.documentation.length > 100000)) return false
    if (node.deprecated !== undefined && typeof node.deprecated !== 'boolean') return false
    if (node.deprecationReason !== undefined && (typeof node.deprecationReason !== 'string' || node.deprecationReason.length > 4096)) return false
    if (node.bodyMode !== undefined && !['form-data', 'urlencoded', 'graphql', 'json', 'xml', 'yaml', 'edn', 'text', 'other', 'file', 'none'].includes(String(node.bodyMode))) return false
    if (node.bodyPath !== undefined) return false
    if (node.headers !== undefined && (!Array.isArray(node.headers) || node.headers.length > 100 || !node.headers.every((header) => {
      if (!isRecord(header)) return false
      return typeof header.id === 'string' && typeof header.name === 'string' && header.name.length <= 8192 && typeof header.value === 'string' && header.value.length <= 65536 && typeof header.enabled === 'boolean' && (header.description === undefined || typeof header.description === 'string' && header.description.length <= 4096)
    }))) return false
    if (node.params !== undefined && (!Array.isArray(node.params) || node.params.length > 100 || !node.params.every((param) => {
      if (!isRecord(param)) return false
      return typeof param.id === 'string' && typeof param.name === 'string' && typeof param.value === 'string' && typeof param.enabled === 'boolean' && (param.description === undefined || typeof param.description === 'string' && param.description.length <= 4096)
    }))) return false
    if (node.auth !== undefined) {
      if (!isRecord(node.auth)) return false
      const auth = node.auth
      const validAuth = auth.type === 'none'
        || auth.type === 'bearer' && typeof auth.token === 'string'
        || auth.type === 'basic' && typeof auth.username === 'string' && typeof auth.password === 'string'
        || auth.type === 'api-key' && typeof auth.name === 'string' && typeof auth.value === 'string' && (auth.location === 'header' || auth.location === 'query')
      if (!validAuth) return false
    }
    if (node.bodyFields !== undefined && (!Array.isArray(node.bodyFields) || node.bodyFields.length > 100 || !node.bodyFields.every((field) => {
      if (!isRecord(field)) return false
      return typeof field.id === 'string' && typeof field.name === 'string' && typeof field.value === 'string' && typeof field.enabled === 'boolean' && (field.type === 'text' || field.type === 'file') && field.filePath === undefined && (field.fileName === undefined || typeof field.fileName === 'string')
    }))) return false
    return ['bodyVariables', 'bodyMimeType', 'bodyPath', 'bodyFileName'].every((key) => node[key] === undefined || typeof node[key] === 'string')
  }
  return value.every((node) => valid(node, 0))
}

async function bodyOf(request: Request): Promise<Record<string, unknown>> {
  try {
    const body: unknown = await request.json()
    if (!isRecord(body)) throw new Error()
    return body
  } catch { throw new AppError('BODY_NOT_OBJECT') }
}

async function currentUser(request: Request): Promise<AuthUser> {
  const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!bearer) throw new AppError('AUTH_REQUIRED')
  const [user] = await db`SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ${tokenHash(bearer)} AND s.expires_at > now()`
  if (!user) throw new AppError('SESSION_EXPIRED')
  return user as AuthUser
}

async function requireRole(workspaceId: string, userId: string, allowed: Role[]): Promise<Role> {
  const [membership] = await db`SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
  if (!membership) throw new AppError('WORKSPACE_NOT_FOUND')
  const role = membership.role as Role
  if (!allowed.includes(role)) throw new AppError('ROLE_NOT_ALLOWED')
  return role
}

async function createSession(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  await db`INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (${tokenHash(token)}, ${userId}, ${new Date(Date.now() + sessionLifetimeMs)})`
  return token
}

// Sends one event to every open socket of a current member of the workspace.
async function sendToMembers(workspaceId: string, event: string) {
  const members = await db`SELECT user_id AS "userId" FROM memberships WHERE workspace_id = ${workspaceId}`
  const memberIds = new Set(members.map((member: { userId: unknown }) => String(member.userId)))
  for (const socket of syncSockets) {
    if (!memberIds.has(socket.data.userId)) continue
    try { socket.send(event) }
    catch { syncSockets.delete(socket) }
  }
}

async function broadcastWorkspaceUpdate(workspaceId: string, headId: string, message: string, actor: AuthUser, commitCount: number) {
  await sendToMembers(workspaceId, JSON.stringify({
    type: 'workspace.updated',
    workspaceId,
    headCommitId: headId,
    message,
    actorId: actor.id,
    actorEmail: actor.email,
    commitCount
  }))
}

// Tells open pages that something changed, so they reload that part. The reason says which part.
type WorkspaceChangeReason = 'members' | 'invites' | 'settings' | 'deleted'

async function broadcastWorkspaceChange(workspaceId: string, reason: WorkspaceChangeReason) {
  await sendToMembers(workspaceId, JSON.stringify({ type: 'workspace.changed', workspaceId, reason }))
}

async function createWorkspace(user: AuthUser, name: string, snapshot: TreeNode[], variables: WorkspaceVariables) {
  if (!name.trim() || name.trim().length > 100) throw new AppError('WORKSPACE_NAME_INVALID')
  if (!validateTree(snapshot) || !validateWorkspaceVariables(variables)) throw new AppError('WORKSPACE_SNAPSHOT_INVALID')
  variables = sanitizeWorkspaceVariables(variables)
  const workspaceId = randomUUID()
  const commitId = randomUUID()
  await db.begin(async (tx) => {
    await tx`INSERT INTO workspaces (id, name, owner_id, head_commit_id) VALUES (${workspaceId}, ${name.trim()}, ${user.id}, ${commitId})`
    await tx`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${workspaceId}, ${user.id}, 'owner')`
    await tx`INSERT INTO commits (id, workspace_id, author_id, parent_ids, message, snapshot) VALUES (${commitId}, ${workspaceId}, ${user.id}, '[]'::jsonb, 'Workspace created', ${JSON.stringify({ tree: snapshot, variables })}::jsonb)`
  })
  return { id: workspaceId, name: name.trim(), role: 'owner' as Role, headCommitId: commitId, tree: snapshot, variables }
}

async function handle(request: Request, server: Bun.Server<SyncSocketData>): Promise<Response | undefined> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = request.method.toUpperCase()
  if (method === 'GET' && path === '/health') return ok({ ok: true })

  if (method === 'GET' && path === '/api/sync/events') {
    if (!isAllowedSyncOrigin(request.headers.get('origin'))) throw new AppError('WEBSOCKET_ORIGIN_NOT_ALLOWED')
    const ticket = url.searchParams.get('ticket')
    const ticketKey = ticket ? tokenHash(ticket) : ''
    const ticketData = ticketKey ? syncSocketTickets.get(ticketKey) : undefined
    if (!ticketData || ticketData.expiresAt <= Date.now()) {
      if (ticketKey) syncSocketTickets.delete(ticketKey)
      throw new AppError('WEBSOCKET_TICKET_INVALID')
    }
    syncSocketTickets.delete(ticketKey)
    if (!server.upgrade(request, { data: { userId: ticketData.userId } })) throw new AppError('WEBSOCKET_UNAVAILABLE')
    return undefined
  }

  if (method === 'POST' && path === '/api/auth/register') {
    enforceLimit(`register:${clientAddress(request)}`, 10, 60 * 60_000)
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AppError('EMAIL_INVALID')
    if (password.length < 10 || password.length > 256) throw new AppError('PASSWORD_LENGTH_INVALID')
    const id = randomUUID()
    try {
      const hash = await Bun.password.hash(password, { algorithm: 'argon2id' })
      await db`INSERT INTO users (id, email, password_hash) VALUES (${id}, ${email}, ${hash})`
    } catch (error) {
      if (isRecord(error) && error.code === '23505') throw new AppError('EMAIL_TAKEN')
      throw error
    }
    const token = await createSession(id)
    return created({ token, user: { id, email } })
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    enforceLimit(`login:${clientAddress(request)}`, 30, 15 * 60_000)
    if (email) enforceLimit(`login-email:${email}`, 10, 15 * 60_000)
    const [user] = await db`SELECT id, email, password_hash FROM users WHERE email = ${email}`
    if (!user || !await Bun.password.verify(password, user.password_hash)) throw new AppError('INVALID_CREDENTIALS')
    const token = await createSession(user.id)
    return ok({ token, user: { id: user.id, email: user.email } })
  }

  if (method === 'POST' && path === '/api/auth/forgot-password') {
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    enforceLimit(`forgot-ip:${clientAddress(request)}`, 10, 60 * 60_000)
    if (email) enforceLimit(`forgot-email:${email}`, 3, 60 * 60_000)
    const [account] = await db`SELECT id, email FROM users WHERE email = ${email}`
    if (account) {
      const rawToken = randomBytes(32).toString('base64url')
      await db.begin(async (tx) => {
        await tx`DELETE FROM password_resets WHERE user_id = ${account.id} AND used_at IS NULL`
        await tx`INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (${tokenHash(rawToken)}, ${account.id}, ${new Date(Date.now() + 60 * 60_000)})`
      })
      if (!config.smtp.host) logger.warn('SMTP_HOST is not set. A password reset email was not sent.')
      else {
        try { await sendPasswordResetEmail(account.email, `${config.publicWebUrl}/reset-password?token=${encodeURIComponent(rawToken)}`) }
        catch (error) { logger.error('Password reset email delivery failed', { error }) }
      }
    }
    return noContent()
  }

  if (method === 'POST' && path === '/api/auth/reset-password') {
    enforceLimit(`reset-ip:${clientAddress(request)}`, 20, 15 * 60_000)
    const body = await bodyOf(request)
    const rawToken = typeof body.token === 'string' ? body.token.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (password.length < 10 || password.length > 256) throw new AppError('PASSWORD_LENGTH_INVALID')
    const hash = await Bun.password.hash(password, { algorithm: 'argon2id' })
    const reset = await db.begin(async (tx) => {
      const [row] = await tx`SELECT user_id FROM password_resets WHERE token_hash = ${tokenHash(rawToken)} AND used_at IS NULL AND expires_at > now() FOR UPDATE`
      if (!row) return false
      await tx`UPDATE users SET password_hash = ${hash} WHERE id = ${row.user_id}`
      await tx`UPDATE password_resets SET used_at = now() WHERE token_hash = ${tokenHash(rawToken)}`
      await tx`DELETE FROM sessions WHERE user_id = ${row.user_id}`
      return true
    })
    if (!reset) throw new AppError('RESET_TOKEN_INVALID')
    return noContent()
  }

  if (method === 'GET' && path === '/api/me') return ok({ user: await currentUser(request) })

  if (method === 'POST' && path === '/api/desktop-login/exchange') {
    const body = await bodyOf(request)
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    if (!code) throw new AppError('DESKTOP_CODE_REQUIRED')
    const key = tokenHash(code)
    const entry = desktopLoginCodes.get(key)
    desktopLoginCodes.delete(key)
    if (!entry || entry.expiresAt <= Date.now()) throw new AppError('DESKTOP_CODE_INVALID')
    const [matchedUser] = await db`SELECT id, email FROM users WHERE id = ${entry.userId}`
    if (!matchedUser) throw new AppError('ACCOUNT_NOT_FOUND')
    const token = await createSession(entry.userId)
    return ok({ token, user: { id: matchedUser.id, email: matchedUser.email } })
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const bearer = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]
    if (bearer) await db`DELETE FROM sessions WHERE token_hash = ${tokenHash(bearer)}`
    return noContent()
  }

  const user = await currentUser(request)
  if (method === 'POST' && path === '/api/sync/events-ticket') {
    const now = Date.now()
    for (const [key, value] of syncSocketTickets) if (value.expiresAt <= now) syncSocketTickets.delete(key)
    const ticket = randomBytes(32).toString('base64url')
    syncSocketTickets.set(tokenHash(ticket), { userId: user.id, expiresAt: now + 30_000 })
    return created({ ticket, expiresInSeconds: 30 })
  }

  if (method === 'POST' && path === '/api/desktop-login/approve') {
    const now = Date.now()
    for (const [key, value] of desktopLoginCodes) if (value.expiresAt <= now) desktopLoginCodes.delete(key)
    const code = randomBytes(32).toString('base64url')
    desktopLoginCodes.set(tokenHash(code), { userId: user.id, expiresAt: now + 2 * 60_000 })
    return created({ code, expiresInSeconds: 120 })
  }

  if (method === 'GET' && path === '/api/workspaces') {
    const limit = readLimit(url)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const cursorAt = cursorText(cursor, 't')
    const cursorId = cursorText(cursor, 'i')
    const rows: Array<{ id: string; name: string; role: string; headCommitId: string | null; createdAt: Date; updatedAt: Date | null; sortAt: string }> = await db`SELECT * FROM (SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", w.created_at AS "createdAt", c.created_at AS "updatedAt", COALESCE(c.created_at, w.created_at)::text AS "sortAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE m.user_id = ${user.id}) q WHERE ${cursorAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${cursorAt}::timestamptz, ${cursorId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${limit + 1}`
    const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
    return ok({ workspaces: page.items.map(({ sortAt: _sortAt, ...workspace }) => workspace) }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && path === '/api/workspaces') {
    const body = await bodyOf(request)
    const tree = body.tree === undefined ? [] : body.tree
    const variables = body.variables === undefined ? emptyWorkspaceVariables() : body.variables
    if (!validateTree(tree)) throw new AppError('WORKSPACE_TREE_INVALID')
    if (!validateWorkspaceVariables(variables)) throw new AppError('WORKSPACE_VARIABLES_INVALID')
    return created({ workspace: await createWorkspace(user, String(body.name || ''), tree, variables) })
  }

  if (method === 'POST' && path === '/api/invites/accept') {
    const body = await bodyOf(request)
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!token) throw new AppError('INVITE_TOKEN_REQUIRED')
    const result = await db.begin(async (tx) => {
      const [invite] = await tx`SELECT id, workspace_id, email, role FROM invites WHERE token_hash = ${tokenHash(token)} AND used_at IS NULL AND expires_at > now() FOR UPDATE`
      if (!invite) return null
      if (invite.email && String(invite.email).toLowerCase() !== user.email.toLowerCase()) throw new AppError('INVITE_EMAIL_MISMATCH', { params: { email: String(invite.email) } })
      await tx`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${invite.workspace_id}, ${user.id}, ${invite.role}) ON CONFLICT (workspace_id, user_id) DO NOTHING`
      await tx`UPDATE invites SET used_at = now() WHERE id = ${invite.id}`
      const [workspace] = await tx`SELECT id, name, head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${invite.workspace_id}`
      const [commit] = await tx`SELECT snapshot FROM commits WHERE id = ${workspace.headCommitId}`
      const snapshot = parseSnapshot(parseJson<unknown>(commit.snapshot, []))
      return { ...workspace, role: invite.role, ...snapshot }
    })
    if (!result) throw new AppError('INVITE_INVALID')
    await broadcastWorkspaceChange(result.id, 'members')
    return created({ workspace: result })
  }

  const workspaceMatch = path.match(/^\/api\/workspaces\/([\w-]+)(?:\/(.*))?$/)
  if (!workspaceMatch) throw new AppError('ROUTE_NOT_FOUND')
  const workspaceId = workspaceMatch[1]
  const action = workspaceMatch[2] || ''

  if (method === 'PATCH' && action === '') {
    await requireRole(workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 100) throw new AppError('WORKSPACE_NAME_INVALID')
    await db`UPDATE workspaces SET name = ${name} WHERE id = ${workspaceId}`
    await broadcastWorkspaceChange(workspaceId, 'settings')
    const [workspace] = await db`SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", w.created_at AS "createdAt", c.created_at AS "updatedAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE w.id = ${workspaceId} AND m.user_id = ${user.id}`
    return ok({ workspace })
  }

  if (method === 'DELETE' && action === '') {
    await requireRole(workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const [workspace] = await db`SELECT name FROM workspaces WHERE id = ${workspaceId}`
    if (typeof body.confirmName !== 'string' || body.confirmName.trim() !== workspace.name) throw new AppError('WORKSPACE_DELETE_CONFIRMATION_MISMATCH')
    await broadcastWorkspaceChange(workspaceId, 'deleted')
    await db`DELETE FROM workspaces WHERE id = ${workspaceId}`
    return noContent()
  }

  const memberMatch = action.match(/^members\/([\w-]+)$/)
  if (method === 'PATCH' && memberMatch) {
    await requireRole(workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const role = body.role === 'editor' ? 'editor' : body.role === 'viewer' ? 'viewer' : null
    if (!role) throw new AppError('MEMBER_ROLE_INVALID')
    const [target] = await db`SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${memberMatch[1]}`
    if (!target) throw new AppError('MEMBER_NOT_FOUND')
    if (target.role === 'owner') throw new AppError('OWNER_ROLE_IMMUTABLE')
    await db`UPDATE memberships SET role = ${role} WHERE workspace_id = ${workspaceId} AND user_id = ${memberMatch[1]}`
    await broadcastWorkspaceChange(workspaceId, 'members')
    return ok({ member: { userId: memberMatch[1], role } })
  }

  if (method === 'DELETE' && memberMatch) {
    const actorRole = await requireRole(workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const targetId = memberMatch[1]
    if (targetId !== user.id && actorRole !== 'owner') throw new AppError('OWNER_REQUIRED_TO_REMOVE_MEMBERS')
    const [target] = await db`SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${targetId}`
    if (!target) throw new AppError('MEMBER_NOT_FOUND')
    if (target.role === 'owner') throw new AppError('OWNER_CANNOT_LEAVE')
    // Sent before the delete, so the removed member's open page also hears about it.
    await broadcastWorkspaceChange(workspaceId, 'members')
    await db`DELETE FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${targetId}`
    return noContent()
  }

  if (method === 'GET' && action === 'members') {
    await requireRole(workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const limit = readLimit(url)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const cursorRank = cursorText(cursor, 'r')
    const cursorAt = cursorText(cursor, 't')
    const cursorId = cursorText(cursor, 'i')
    const rows: Array<{ id: string; email: string; role: string; joinedAt: Date; rank: number; sortAt: string }> = await db`SELECT * FROM (SELECT u.id, u.email, m.role, m.created_at AS "joinedAt", CASE m.role WHEN 'owner' THEN 0 WHEN 'editor' THEN 1 ELSE 2 END AS rank, m.created_at::text AS "sortAt" FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ${workspaceId}) q WHERE ${cursorRank}::text IS NULL OR (q.rank, q."sortAt"::timestamptz, q.id) > (${cursorRank}::int, ${cursorAt}::timestamptz, ${cursorId}::text) ORDER BY q.rank, q."sortAt"::timestamptz, q.id LIMIT ${limit + 1}`
    const page = pageOf(rows, limit, (row) => encodeCursor({ r: String(row.rank), t: row.sortAt, i: row.id }))
    return ok({ members: page.items.map(({ rank: _rank, sortAt: _sortAt, ...member }) => member) }, { nextCursor: page.nextCursor })
  }

  if (method === 'GET' && action === 'invites') {
    await requireRole(workspaceId, user.id, ['owner'])
    const limit = readLimit(url)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const cursorAt = cursorText(cursor, 't')
    const cursorId = cursorText(cursor, 'i')
    const rows: Array<{ id: string; email: string; role: string; expiresAt: Date; createdAt: Date; createdByEmail: string; sortAt: string }> = await db`SELECT * FROM (SELECT i.id, i.email, i.role, i.expires_at AS "expiresAt", i.created_at AS "createdAt", u.email AS "createdByEmail", i.created_at::text AS "sortAt" FROM invites i JOIN users u ON u.id = i.created_by WHERE i.workspace_id = ${workspaceId} AND i.used_at IS NULL AND i.expires_at > now()) q WHERE ${cursorAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${cursorAt}::timestamptz, ${cursorId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${limit + 1}`
    const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
    return ok({ invites: page.items.map(({ sortAt: _sortAt, ...invite }) => invite) }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && action === 'invites') {
    await requireRole(workspaceId, user.id, ['owner'])
    enforceLimit(`invite:${user.id}`, 50, 60 * 60_000)
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AppError('INVITE_EMAIL_INVALID')
    const role = body.role === 'viewer' ? 'viewer' : body.role === 'editor' ? 'editor' : null
    if (!role) throw new AppError('INVITE_ROLE_INVALID')
    const [workspace] = await db`SELECT name FROM workspaces WHERE id = ${workspaceId}`
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    const [existingMember] = await db`SELECT m.user_id FROM memberships m JOIN users u ON u.id = m.user_id WHERE m.workspace_id = ${workspaceId} AND lower(u.email) = ${email}`
    if (existingMember) throw new AppError('ALREADY_MEMBER')
    await db`DELETE FROM invites WHERE workspace_id = ${workspaceId} AND lower(email) = ${email} AND used_at IS NULL`
    const rawToken = randomBytes(32).toString('base64url')
    const id = randomUUID()
    await db`INSERT INTO invites (id, workspace_id, email, token_hash, role, expires_at, created_by) VALUES (${id}, ${workspaceId}, ${email}, ${tokenHash(rawToken)}, ${role}, ${new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)}, ${user.id})`
    await broadcastWorkspaceChange(workspaceId, 'invites')
    const inviteUrl = `${config.publicWebUrl}/invite?token=${encodeURIComponent(rawToken)}`
    let emailSent = false
    if (config.smtp.host) {
      try { await sendInviteEmail(email, String(workspace.name), role, user.email, inviteUrl); emailSent = true }
      catch (error) { logger.error('Workspace invitation email delivery failed', { error }) }
    }
    return created({ id, token: rawToken, email, expiresInDays: 7, role, emailSent })
  }

  const inviteMatch = action.match(/^invites\/([\w-]+)$/)
  if (method === 'DELETE' && inviteMatch) {
    await requireRole(workspaceId, user.id, ['owner'])
    await db`DELETE FROM invites WHERE id = ${inviteMatch[1]} AND workspace_id = ${workspaceId}`
    await broadcastWorkspaceChange(workspaceId, 'invites')
    return noContent()
  }

  if (method === 'GET' && action === 'sync/pull') {
    await requireRole(workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const [workspace] = await db`SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", c.parent_ids AS "parentIds", c.message, c.snapshot, c.created_at AS "createdAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE w.id = ${workspaceId} AND m.user_id = ${user.id}`
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    const snapshot = parseSnapshot(parseJson<unknown>(workspace.snapshot, []))
    const { snapshot: _snapshot, ...workspaceData } = workspace
    return ok({ workspace: { ...workspaceData, parentIds: parseJson<string[]>(workspace.parentIds, []), ...snapshot } })
  }

  if (method === 'GET' && action === 'sync/history') {
    await requireRole(workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const limit = readLimit(url)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const cursorAt = cursorText(cursor, 't')
    const cursorId = cursorText(cursor, 'i')
    const rows: Array<{ id: unknown; parentIds: unknown; message: unknown; createdAt: string | Date; authorEmail: unknown; sortAt: string }> = await db`SELECT * FROM (SELECT c.id, c.parent_ids AS "parentIds", c.message, c.created_at AS "createdAt", u.email AS "authorEmail", c.created_at::text AS "sortAt" FROM commits c JOIN users u ON u.id = c.author_id WHERE c.workspace_id = ${workspaceId}) q WHERE ${cursorAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id::text) < (${cursorAt}::timestamptz, ${cursorId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${limit + 1}`
    const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: String(row.id) }))
    const commits = page.items.map((row) => ({
      id: String(row.id),
      parentIds: parseJson<string[]>(row.parentIds, []),
      message: String(row.message),
      createdAt: row.createdAt,
      authorEmail: String(row.authorEmail)
    }))
    return ok({ commits }, { nextCursor: page.nextCursor })
  }

  const historyCommitMatch = action.match(/^sync\/history\/([\w-]+)$/)
  if (method === 'GET' && historyCommitMatch) {
    await requireRole(workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const [row] = await db`SELECT id, parent_ids AS "parentIds", message, snapshot, created_at AS "createdAt" FROM commits WHERE workspace_id = ${workspaceId} AND id = ${historyCommitMatch[1]}`
    if (!row) throw new AppError('COMMIT_NOT_FOUND')
    return ok({ commit: {
      id: String(row.id),
      parentIds: parseJson<string[]>(row.parentIds, []),
      message: String(row.message),
      createdAt: row.createdAt,
      ...parseSnapshot(parseJson<unknown>(row.snapshot, []))
    } })
  }

  const restoreMatch = action.match(/^sync\/restore\/([\w-]+)$/)
  if (method === 'POST' && restoreMatch) {
    await requireRole(workspaceId, user.id, ['owner', 'editor'])
    const sourceId = restoreMatch[1]
    const result = await db.begin(async (tx) => {
      const [workspace] = await tx`SELECT head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`
      if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
      if (workspace.headCommitId === sourceId) throw new AppError('VERSION_ALREADY_LATEST')
      const [source] = await tx`SELECT snapshot FROM commits WHERE workspace_id = ${workspaceId} AND id = ${sourceId}`
      if (!source) throw new AppError('COMMIT_NOT_FOUND')
      const snapshot = parseSnapshot(parseJson<unknown>(source.snapshot, []))
      const restoredId = randomUUID()
      const parents = workspace.headCommitId ? [workspace.headCommitId] : []
      const message = `Restore to ${sourceId.slice(0, 7)}`
      await tx`INSERT INTO commits (id, workspace_id, author_id, parent_ids, message, snapshot) VALUES (${restoredId}, ${workspaceId}, ${user.id}, ${JSON.stringify(parents)}::jsonb, ${message}, ${JSON.stringify(snapshot)}::jsonb)`
      await tx`UPDATE workspaces SET head_commit_id = ${restoredId} WHERE id = ${workspaceId}`
      return { headId: restoredId, message }
    })
    await broadcastWorkspaceUpdate(workspaceId, result.headId, result.message, user, 1)
    return created({ headCommitId: result.headId })
  }

  if (method === 'POST' && action === 'sync/push') {
    await requireRole(workspaceId, user.id, ['owner', 'editor'])
    const body = await bodyOf(request)
    if (!Array.isArray(body.commits) || body.commits.length === 0 || body.commits.length > 100) throw new AppError('PUSH_COMMITS_COUNT_INVALID')
    const commits = body.commits as Record<string, unknown>[]
    for (const commit of commits) {
      const variables = commit.variables === undefined ? emptyWorkspaceVariables() : commit.variables
      if (typeof commit.id !== 'string' || !Array.isArray(commit.parentIds) || typeof commit.message !== 'string' || !validateTree(commit.tree) || !validateWorkspaceVariables(variables)) throw new AppError('PUSH_COMMIT_INVALID')
    }
    const result = await db.begin(async (tx) => {
      const [workspace] = await tx`SELECT head_commit_id AS "headCommitId" FROM workspaces WHERE id = ${workspaceId} FOR UPDATE`
      if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
      let headId = workspace.headCommitId as string | null
      for (const commit of commits) {
        const parents = commit.parentIds as string[]
        if (headId && !parents.includes(headId)) {
          const [remote] = await tx`SELECT id, parent_ids AS "parentIds", message, snapshot, created_at AS "createdAt" FROM commits WHERE id = ${headId}`
          const snapshot = remote ? parseSnapshot(parseJson<unknown>(remote.snapshot, [])) : null
          const { snapshot: _snapshot, ...remoteData } = remote ?? {}
          return { conflict: remote && snapshot ? { ...remoteData, parentIds: parseJson<string[]>(remote.parentIds, []), ...snapshot } : null }
        }
        if (!headId && parents.length > 0) return { conflict: null }
        const variables = sanitizeWorkspaceVariables(commit.variables === undefined ? emptyWorkspaceVariables() : commit.variables as WorkspaceVariables)
        await tx`INSERT INTO commits (id, workspace_id, author_id, parent_ids, message, snapshot) VALUES (${commit.id}, ${workspaceId}, ${user.id}, ${JSON.stringify(parents)}::jsonb, ${commit.message}, ${JSON.stringify({ tree: commit.tree, variables })}::jsonb) ON CONFLICT (id) DO NOTHING`
        headId = commit.id as string
        await tx`UPDATE workspaces SET head_commit_id = ${headId} WHERE id = ${workspaceId}`
      }
      return { headId }
    })
    if ('conflict' in result) throw new AppError('SYNC_REMOTE_ADVANCED', { details: { remote: result.conflict } })
    if (result.headId) {
      const lastCommit = commits[commits.length - 1]
      await broadcastWorkspaceUpdate(workspaceId, result.headId, typeof lastCommit.message === 'string' ? lastCommit.message : 'Workspace updated', user, commits.length)
    }
    return created({ headCommitId: result.headId })
  }

  throw new AppError('ROUTE_NOT_FOUND')
}

async function initialize() {
  const applied = await runMigrations(db, new URL('../migrations/', import.meta.url), logger)
  if (applied > 0) logger.info('migrations applied', { count: applied })
  Bun.serve({
    port: config.port,
    websocket: {
      data: {} as SyncSocketData,
      open(socket) { syncSockets.add(socket) },
      message(socket) { socket.close(1008, 'Client messages are not supported.') },
      close(socket) { syncSockets.delete(socket) }
    },
    async fetch(request, server) {
      const started = performance.now()
      const requestId = resolveRequestId(request.headers.get('X-Request-Id'))
      const locale = negotiateLocale(request.headers.get('Accept-Language'))
      const origin = request.headers.get('Origin')
      const path = new URL(request.url).pathname
      let response: Response | undefined
      try {
        response = await runWithRequestId(requestId, () => handle(request, server))
      } catch (error) {
        const duplicate = isRecord(error) && error.code === '23505'
        response = errorResponse(duplicate ? new AppError('ALREADY_MEMBER') : error, { requestId, locale, logger })
      }
      if (!response) return undefined
      logRequest({ method: request.method, path, status: response.status, durationMs: performance.now() - started, requestId })
      return withResponseHeaders(response, { requestId, origin, allowedOrigins: config.corsOrigins, sensitive: isSensitivePath(path) })
    }
  })
  logger.info('API server listening', { port: config.port, corsOrigins: config.corsOrigins.length })
}

function logRequest({ method, path, status, durationMs, requestId }: { method: string; path: string; status: number; durationMs: number; requestId: string }) {
  const fields = { method, route: routeLabel(path), status, durationMs: Math.round(durationMs), requestId }
  if (status >= 500) logger.error('request', fields)
  else if (status >= 400) logger.warn('request', fields)
  else logger.info('request', fields)
}

await initialize()
