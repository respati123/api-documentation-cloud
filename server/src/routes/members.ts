import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { broadcastWorkspaceChange } from '@/services/events'
import { created, noContent, ok } from '@/lib/http'
import { cursorText, decodeCursor, encodeCursor, pageOf, readLimit } from '@/lib/pagination'
import { enforceLimit, tokenHash } from '@/services/auth'
import { randomBytes, randomUUID } from 'node:crypto'
import { requireRole } from '@/services/access'
import { sendInviteEmail } from '@/services/mail'


export async function handleMembers(ctx: AppContext, request: Request, url: URL, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const { db, config, logger, limiter } = ctx
  const memberMatch = action.match(/^members\/([\w-]+)$/)

  if (method === 'PATCH' && memberMatch) {
    await requireRole(db, workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const role = body.role === 'editor' ? 'editor' : body.role === 'viewer' ? 'viewer' : null
    if (!role) throw new AppError('MEMBER_ROLE_INVALID')
    const [target] = await db`SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${memberMatch[1]}`
    if (!target) throw new AppError('MEMBER_NOT_FOUND')
    if (target.role === 'owner') throw new AppError('OWNER_ROLE_IMMUTABLE')
    await db`UPDATE memberships SET role = ${role} WHERE workspace_id = ${workspaceId} AND user_id = ${memberMatch[1]}`
    await broadcastWorkspaceChange(ctx, workspaceId, 'members')
    return ok({ member: { userId: memberMatch[1], role } })
  }

  if (method === 'DELETE' && memberMatch) {
    const actorRole = await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const targetId = memberMatch[1]
    if (targetId !== user.id && actorRole !== 'owner') throw new AppError('OWNER_REQUIRED_TO_REMOVE_MEMBERS')
    const [target] = await db`SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${targetId}`
    if (!target) throw new AppError('MEMBER_NOT_FOUND')
    if (target.role === 'owner') throw new AppError('OWNER_CANNOT_LEAVE')
    // Sent before the delete, so the removed member's open page also hears about it.
    await broadcastWorkspaceChange(ctx, workspaceId, 'members')
    await db`DELETE FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${targetId}`
    return noContent()
  }

  if (method === 'GET' && action === 'members') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
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
    await requireRole(db, workspaceId, user.id, ['owner'])
    const limit = readLimit(url)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const cursorAt = cursorText(cursor, 't')
    const cursorId = cursorText(cursor, 'i')
    const rows: Array<{ id: string; email: string; role: string; expiresAt: Date; createdAt: Date; createdByEmail: string; sortAt: string }> = await db`SELECT * FROM (SELECT i.id, i.email, i.role, i.expires_at AS "expiresAt", i.created_at AS "createdAt", u.email AS "createdByEmail", i.created_at::text AS "sortAt" FROM invites i JOIN users u ON u.id = i.created_by WHERE i.workspace_id = ${workspaceId} AND i.used_at IS NULL AND i.expires_at > now()) q WHERE ${cursorAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${cursorAt}::timestamptz, ${cursorId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${limit + 1}`
    const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
    return ok({ invites: page.items.map(({ sortAt: _sortAt, ...invite }) => invite) }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && action === 'invites') {
    await requireRole(db, workspaceId, user.id, ['owner'])
    enforceLimit(limiter, `invite:${user.id}`, 50, 60 * 60_000)
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
    await broadcastWorkspaceChange(ctx, workspaceId, 'invites')
    const inviteUrl = `${config.publicWebUrl}/invite?token=${encodeURIComponent(rawToken)}`
    let emailSent = false
    if (config.smtp.host) {
      try { await sendInviteEmail(config, email, String(workspace.name), role, user.email, inviteUrl); emailSent = true }
      catch (error) { logger.error('Workspace invitation email delivery failed', { error }) }
    }
    return created({ id, token: rawToken, email, expiresInDays: 7, role, emailSent })
  }

  const inviteMatch = action.match(/^invites\/([\w-]+)$/)

  if (method === 'DELETE' && inviteMatch) {
    await requireRole(db, workspaceId, user.id, ['owner'])
    await db`DELETE FROM invites WHERE id = ${inviteMatch[1]} AND workspace_id = ${workspaceId}`
    await broadcastWorkspaceChange(ctx, workspaceId, 'invites')
    return noContent()
  }
  return undefined
}
