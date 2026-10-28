import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { broadcastWorkspaceChange } from '@/services/events'
import { created } from '@/lib/http'
import { parseJson, parseSnapshot } from '@/lib/validation'
import { tokenHash } from '@/services/auth'


export async function handleInviteAccept(ctx: AppContext, request: Request, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
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
    await broadcastWorkspaceChange(ctx, result.id, 'members')
    return created({ workspace: result })
  }
  return undefined
}
