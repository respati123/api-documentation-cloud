import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created, noContent, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import type { AuthUser } from '@/models/workspace'
import { enforceLimit } from '@/services/auth'
import { assignUserRoles, cancelUserInvite, createUserRole, inviteUser, listUserRoleMaster, listUserInvitesForAdmin, listUsersForAdmin, removeUserRole, setAppAdminStatus } from '@/services/admin-users'

export async function handleAdminUserRoutes(ctx: AppContext, request: Request, url: URL, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  if (method === 'GET' && path === '/api/admin/roles') {
    return ok({ roles: await listUserRoleMaster(ctx.db, user.id) })
  }

  if (method === 'POST' && path === '/api/admin/roles') {
    const body = await bodyOf(request)
    if (typeof body.name !== 'string') throw new AppError('USER_ROLE_NAME_INVALID')
    return created(await createUserRole(ctx.db, user.id, body.name))
  }

  const roleMatch = path.match(/^\/api\/admin\/roles\/([\w-]+)$/)
  if (method === 'DELETE' && roleMatch) {
    await removeUserRole(ctx.db, user.id, roleMatch[1])
    return noContent()
  }

  if (method === 'GET' && path === '/api/admin/users') {
    const page = await listUsersForAdmin(ctx.db, user.id, url.searchParams.get('q') ?? '', readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ users: page.items }, { nextCursor: page.nextCursor, total: page.total })
  }

  const userMatch = path.match(/^\/api\/admin\/users\/([\w-]+)$/)
  if (method === 'PATCH' && userMatch) {
    const body = await bodyOf(request)
    const changesAdmin = body.isAdmin !== undefined
    const changesRoles = body.roles !== undefined
    if (changesAdmin && typeof body.isAdmin !== 'boolean') throw new AppError('APP_ADMIN_INPUT_INVALID')
    if (!changesAdmin && !changesRoles) throw new AppError('USER_ROLES_INVALID')
    if (changesRoles && (!Array.isArray(body.roles) || body.roles.length > 100 || body.roles.some((role) => typeof role !== 'string' || !role.trim()))) {
      throw new AppError('USER_ROLES_INVALID')
    }
    if (changesAdmin) await setAppAdminStatus(ctx.db, user.id, userMatch[1], body.isAdmin as boolean)
    const roles = changesRoles ? [...new Set(body.roles as string[])] : undefined
    if (roles) await assignUserRoles(ctx.db, user.id, userMatch[1], roles)
    return ok({ user: { id: userMatch[1], ...(roles ? { roles } : {}), ...(changesAdmin ? { isAdmin: body.isAdmin } : {}) } })
  }

  if (method === 'GET' && path === '/api/admin/user-invites') {
    const page = await listUserInvitesForAdmin(ctx.db, user.id, readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ invites: page.items }, { nextCursor: page.nextCursor, total: page.total })
  }

  if (method === 'POST' && path === '/api/admin/user-invites') {
    enforceLimit(ctx.limiter, `user-invite:${user.id}`, 50, 60 * 60_000)
    const body = await bodyOf(request)
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new AppError('INVITE_EMAIL_INVALID')
    return created(await inviteUser(ctx, user, email))
  }

  const inviteMatch = path.match(/^\/api\/admin\/user-invites\/([\w-]+)$/)
  if (method === 'DELETE' && inviteMatch) {
    await cancelUserInvite(ctx.db, user.id, inviteMatch[1])
    return noContent()
  }

  return undefined
}
