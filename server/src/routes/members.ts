import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created, noContent, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import { enforceLimit } from '@/services/auth'
import { requireRole } from '@/services/access'
import { changeMemberRole, listMembersPage, removeMember } from '@/services/members'
import { cancelInvite, createInvite, listInvitesPage } from '@/services/invites'

export async function handleMembers(ctx: AppContext, request: Request, url: URL, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const { db, limiter } = ctx
  const memberMatch = action.match(/^members\/([\w-]+)$/)

  if (method === 'PATCH' && memberMatch) {
    await requireRole(db, workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const role = body.role === 'editor' ? 'editor' : body.role === 'viewer' ? 'viewer' : null
    if (!role) throw new AppError('MEMBER_ROLE_INVALID')
    await changeMemberRole(ctx, workspaceId, memberMatch[1], role)
    return ok({ member: { userId: memberMatch[1], role } })
  }

  if (method === 'DELETE' && memberMatch) {
    const actorRole = await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    await removeMember(ctx, workspaceId, user, actorRole, memberMatch[1])
    return noContent()
  }

  if (method === 'GET' && action === 'members') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const page = await listMembersPage(db, workspaceId, readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ members: page.items }, { nextCursor: page.nextCursor })
  }

  if (method === 'GET' && action === 'invites') {
    await requireRole(db, workspaceId, user.id, ['owner'])
    const page = await listInvitesPage(db, workspaceId, readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ invites: page.items }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && action === 'invites') {
    await requireRole(db, workspaceId, user.id, ['owner'])
    enforceLimit(limiter, `invite:${user.id}`, 50, 60 * 60_000)
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AppError('INVITE_EMAIL_INVALID')
    const role = body.role === 'viewer' ? 'viewer' : body.role === 'editor' ? 'editor' : null
    if (!role) throw new AppError('INVITE_ROLE_INVALID')
    return created(await createInvite(ctx, workspaceId, user, email, role))
  }

  const inviteMatch = action.match(/^invites\/([\w-]+)$/)

  if (method === 'DELETE' && inviteMatch) {
    await requireRole(db, workspaceId, user.id, ['owner'])
    await cancelInvite(ctx, workspaceId, inviteMatch[1])
    return noContent()
  }
  return undefined
}
