import { randomBytes, randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { countPendingUserInvites, deletePendingUserInviteForEmail, deleteUserInvite, insertUserInvite, listPendingUserInvites } from '@/repositories/user-invites.repository'
import { countUsersMatching, deleteRoleMaster, insertRoleMaster, listRoleMaster, listUsersPage, replaceUserRoles, setUserAdminFlag, userEmailExists } from '@/repositories/users.repository'
import type { AuthUser } from '@/models/workspace'
import { requireAdmin } from '@/services/admin'
import { tokenHash } from '@/services/auth'
import { sendUserInviteEmail } from '@/services/mail'

const userInviteLifetimeMs = 7 * 24 * 60 * 60 * 1000

export async function listUserRoleMaster(db: SQL, adminId: string) {
  await requireAdmin(db, adminId)
  return listRoleMaster(db)
}

export async function createUserRole(db: SQL, adminId: string, name: string) {
  await requireAdmin(db, adminId)
  const normalizedName = name.trim()
  if (!normalizedName || normalizedName.length > 60) throw new AppError('USER_ROLE_NAME_INVALID')
  const role = await insertRoleMaster(db, { id: randomUUID(), name: normalizedName })
  if (!role) throw new AppError('USER_ROLE_ALREADY_EXISTS')
  return role
}

export async function removeUserRole(db: SQL, adminId: string, roleId: string): Promise<void> {
  await requireAdmin(db, adminId)
  const result = await deleteRoleMaster(db, roleId)
  if (result === 'not_found') throw new AppError('USER_ROLE_NOT_FOUND')
  if (result === 'in_use') throw new AppError('USER_ROLE_IN_USE')
}

export async function assignUserRoles(db: SQL, adminId: string, userId: string, roles: string[]): Promise<void> {
  await requireAdmin(db, adminId)
  const result = await replaceUserRoles(db, userId, adminId, roles)
  if (result === 'account_missing') throw new AppError('ACCOUNT_NOT_FOUND')
  if (result === 'role_missing') throw new AppError('USER_ROLES_INVALID')
}

// Gives or takes away the app admin status. An admin cannot change their own, so the app always keeps the admin who is signed in.
export async function setAppAdminStatus(db: SQL, adminId: string, userId: string, isAdmin: boolean): Promise<void> {
  await requireAdmin(db, adminId)
  if (adminId === userId) throw new AppError('APP_ADMIN_SELF_CHANGE_FORBIDDEN')
  if (!(await setUserAdminFlag(db, userId, isAdmin))) throw new AppError('ACCOUNT_NOT_FOUND')
}

export async function listUsersForAdmin(db: SQL, adminId: string, search: string, limit: number, cursor: CursorKeys | null) {
  await requireAdmin(db, adminId)
  const after = cursorValues(cursor, ['sortAt', 'id'])
  const normalizedSearch = search.trim().slice(0, 254)
  const [rows, total] = await Promise.all([
    listUsersPage(db, { search: normalizedSearch, after, limit: limit + 1 }),
    countUsersMatching(db, normalizedSearch),
  ])
  const page = pageOf(rows, limit, (row) => encodeCursor({ sortAt: row.sortAt, id: row.id }))
  return { items: page.items.map(({ sortAt: _sortAt, ...user }) => user), nextCursor: page.nextCursor, total }
}

export async function listUserInvitesForAdmin(db: SQL, adminId: string, limit: number, cursor: CursorKeys | null) {
  await requireAdmin(db, adminId)
  const after = cursorValues(cursor, ['sortAt', 'id'])
  const [rows, total] = await Promise.all([
    listPendingUserInvites(db, { after, limit: limit + 1 }),
    countPendingUserInvites(db),
  ])
  const page = pageOf(rows, limit, (invite) => encodeCursor({ sortAt: invite.sortAt, id: invite.id }))
  return { items: page.items.map(({ sortAt: _sortAt, ...invite }) => invite), nextCursor: page.nextCursor, total }
}

export async function inviteUser(ctx: AppContext, actor: AuthUser, email: string) {
  await requireAdmin(ctx.db, actor.id)
  if (await userEmailExists(ctx.db, email)) throw new AppError('USER_ALREADY_EXISTS')
  await deletePendingUserInviteForEmail(ctx.db, email)
  const rawToken = randomBytes(32).toString('base64url')
  const id = randomUUID()
  await insertUserInvite(ctx.db, {
    id,
    email,
    tokenHash: tokenHash(rawToken),
    expiresAt: new Date(Date.now() + userInviteLifetimeMs),
    createdBy: actor.id,
  })
  const inviteUrl = `${ctx.config.publicWebUrl}/join?token=${encodeURIComponent(rawToken)}`
  let emailSent = false
  if (ctx.config.smtp.host) {
    try {
      await sendUserInviteEmail(ctx.config, email, actor.email, inviteUrl)
      emailSent = true
    } catch (error) {
      ctx.logger.error('User invitation email delivery failed', { error })
    }
  }
  return { id, email, token: rawToken, inviteUrl, expiresInDays: 7, emailSent }
}

export async function cancelUserInvite(db: SQL, adminId: string, inviteId: string): Promise<void> {
  await requireAdmin(db, adminId)
  await deleteUserInvite(db, inviteId)
}
