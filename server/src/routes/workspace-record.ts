import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { broadcastWorkspaceChange } from '@/services/events'
import { noContent, ok } from '@/lib/http'
import { requireRole } from '@/services/access'


export async function handleWorkspaceRecord(ctx: AppContext, request: Request, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
  if (method === 'PATCH' && action === '') {
    await requireRole(db, workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length > 100) throw new AppError('WORKSPACE_NAME_INVALID')
    await db`UPDATE workspaces SET name = ${name} WHERE id = ${workspaceId}`
    await broadcastWorkspaceChange(ctx, workspaceId, 'settings')
    const [workspace] = await db`SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", w.created_at AS "createdAt", c.created_at AS "updatedAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE w.id = ${workspaceId} AND m.user_id = ${user.id}`
    return ok({ workspace })
  }

  if (method === 'DELETE' && action === '') {
    await requireRole(db, workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const [workspace] = await db`SELECT name FROM workspaces WHERE id = ${workspaceId}`
    if (typeof body.confirmName !== 'string' || body.confirmName.trim() !== workspace.name) throw new AppError('WORKSPACE_DELETE_CONFIRMATION_MISMATCH')
    await broadcastWorkspaceChange(ctx, workspaceId, 'deleted')
    await db`DELETE FROM workspaces WHERE id = ${workspaceId}`
    return noContent()
  }
  return undefined
}
