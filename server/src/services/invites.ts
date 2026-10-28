import { randomBytes, randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { parseSnapshot } from '@/lib/validation'
import type { AuthUser } from '@/models/workspace'
import { findCommitById } from '@/repositories/commits.repository'
import { hasMemberWithEmail, insertMembership } from '@/repositories/memberships.repository'
import {
  deleteInvite as deleteInviteRow,
  deleteUnusedInvitesForEmail,
  insertInvite,
  listActiveInvites,
  lockActiveInvite,
  markInviteUsed,
  type InviteListRow,
} from '@/repositories/invites.repository'
import { findWorkspaceSummary } from '@/repositories/workspaces.repository'
import { tokenHash } from '@/services/auth'
import { broadcastWorkspaceChange } from '@/services/events'
import { sendInviteEmail } from '@/services/mail'

type InviteRole = 'editor' | 'viewer'

const inviteLifetimeMs = 7 * 24 * 60 * 60 * 1000

export async function listInvitesPage(db: SQL, workspaceId: string, limit: number, cursor: CursorKeys | null) {
  const after = cursorValues(cursor, ['t', 'i'])
  const rows = await listActiveInvites(db, { workspaceId, after: after ? { sortAt: after.t, id: after.i } : null, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
  return { items: page.items.map(withoutSortAt), nextCursor: page.nextCursor }
}

// A new invite replaces any pending invite for the same email, so only one live link exists per address.
export async function createInvite(ctx: AppContext, workspaceId: string, actor: AuthUser, email: string, role: InviteRole) {
  const workspace = await findWorkspaceSummary(ctx.db, workspaceId)
  if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
  if (await hasMemberWithEmail(ctx.db, workspaceId, email)) throw new AppError('ALREADY_MEMBER')
  await deleteUnusedInvitesForEmail(ctx.db, workspaceId, email)
  const rawToken = randomBytes(32).toString('base64url')
  const id = randomUUID()
  await insertInvite(ctx.db, { id, workspaceId, email, tokenHash: tokenHash(rawToken), role, expiresAt: new Date(Date.now() + inviteLifetimeMs), createdBy: actor.id })
  await broadcastWorkspaceChange(ctx, workspaceId, 'invites')
  const emailSent = await deliverInvite(ctx, { email, workspaceName: workspace.name, role, inviterEmail: actor.email, rawToken })
  return { id, token: rawToken, email, expiresInDays: 7, role, emailSent }
}

export async function cancelInvite(ctx: AppContext, workspaceId: string, inviteId: string): Promise<void> {
  await deleteInviteRow(ctx.db, workspaceId, inviteId)
  await broadcastWorkspaceChange(ctx, workspaceId, 'invites')
}

// The invite is locked and marked used in one transaction, so a token works once even under parallel requests.
export async function acceptInvite(ctx: AppContext, user: AuthUser, rawToken: string) {
  const accepted = await ctx.db.begin(async (tx) => {
    const invite = await lockActiveInvite(tx, tokenHash(rawToken))
    if (!invite) return null
    if (invite.email && invite.email.toLowerCase() !== user.email.toLowerCase()) throw new AppError('INVITE_EMAIL_MISMATCH', { params: { email: invite.email } })
    await insertMembership(tx, { workspaceId: invite.workspaceId, userId: user.id, role: invite.role })
    await markInviteUsed(tx, invite.id)
    const workspace = await findWorkspaceSummary(tx, invite.workspaceId)
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    const commit = workspace.headCommitId ? await findCommitById(tx, workspace.headCommitId) : undefined
    return { ...workspace, role: invite.role, ...parseSnapshot(commit?.snapshot ?? []) }
  })
  if (!accepted) throw new AppError('INVITE_INVALID')
  await broadcastWorkspaceChange(ctx, accepted.id, 'members')
  return accepted
}

// Email is optional. A failed send is logged and reported as emailSent: false. The invite link is still returned.
async function deliverInvite(ctx: AppContext, invite: { email: string; workspaceName: string; role: InviteRole; inviterEmail: string; rawToken: string }): Promise<boolean> {
  if (!ctx.config.smtp.host) return false
  const inviteUrl = `${ctx.config.publicWebUrl}/invite?token=${encodeURIComponent(invite.rawToken)}`
  try {
    await sendInviteEmail(ctx.config, invite.email, invite.workspaceName, invite.role, invite.inviterEmail, inviteUrl)
    return true
  } catch (error) {
    ctx.logger.error('Workspace invitation email delivery failed', { error })
    return false
  }
}

function withoutSortAt({ sortAt: _sortAt, ...invite }: InviteListRow) {
  return invite
}
