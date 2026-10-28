import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import type { AuthUser, Role } from '@/models/workspace'
import { deleteMembership, findRole, listMembersPage as listMemberRows, updateRole, type MemberRow } from '@/repositories/memberships.repository'
import { broadcastWorkspaceChange } from '@/services/events'

export async function listMembersPage(db: SQL, workspaceId: string, limit: number, cursor: CursorKeys | null) {
  const after = cursorValues(cursor, ['r', 't', 'i'])
  const rank = after ? Number(after.r) : 0
  if (after && !Number.isInteger(rank)) throw new AppError('PAGINATION_INVALID')
  const rows = await listMemberRows(db, { workspaceId, after: after ? { rank, sortAt: after.t, id: after.i } : null, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ r: String(row.rank), t: row.sortAt, i: row.id }))
  return { items: page.items.map(withoutCursorKeys), nextCursor: page.nextCursor }
}

export async function changeMemberRole(ctx: AppContext, workspaceId: string, memberId: string, role: Role): Promise<void> {
  const targetRole = await findRole(ctx.db, workspaceId, memberId)
  if (!targetRole) throw new AppError('MEMBER_NOT_FOUND')
  if (targetRole === 'owner') throw new AppError('OWNER_ROLE_IMMUTABLE')
  await updateRole(ctx.db, workspaceId, memberId, role)
  await broadcastWorkspaceChange(ctx, workspaceId, 'members')
}

// The removed member is told before the delete, so their open page also hears about it.
export async function removeMember(ctx: AppContext, workspaceId: string, actor: AuthUser, actorRole: Role, targetId: string): Promise<void> {
  if (targetId !== actor.id && actorRole !== 'owner') throw new AppError('OWNER_REQUIRED_TO_REMOVE_MEMBERS')
  const targetRole = await findRole(ctx.db, workspaceId, targetId)
  if (!targetRole) throw new AppError('MEMBER_NOT_FOUND')
  if (targetRole === 'owner') throw new AppError('OWNER_CANNOT_LEAVE')
  await broadcastWorkspaceChange(ctx, workspaceId, 'members')
  await deleteMembership(ctx.db, workspaceId, targetId)
}

function withoutCursorKeys({ rank: _rank, sortAt: _sortAt, ...member }: MemberRow) {
  return member
}
