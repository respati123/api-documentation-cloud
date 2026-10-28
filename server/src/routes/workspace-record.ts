import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { bodyOf } from '@/lib/http-body'
import { noContent, ok } from '@/lib/http'
import { requireRole } from '@/services/access'
import { deleteWorkspace, renameWorkspace } from '@/services/workspaces'

export async function handleWorkspaceRecord(ctx: AppContext, request: Request, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
  if (method === 'PATCH' && action === '') {
    await requireRole(db, workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    return ok({ workspace: await renameWorkspace(ctx, user, workspaceId, name) })
  }

  if (method === 'DELETE' && action === '') {
    await requireRole(db, workspaceId, user.id, ['owner'])
    const body = await bodyOf(request)
    await deleteWorkspace(ctx, workspaceId, body.confirmName)
    return noContent()
  }
  return undefined
}
