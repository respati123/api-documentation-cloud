import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { ok } from '@/lib/http'
import { validateWorkspaceVariables } from '@/lib/validation'
import { getWorkspaceVariables, putWorkspaceVariables } from '@/services/workspace-variables'

// Workspace variables, read and written as one unit with a revision. They are independent of the collection branches.
export async function handleWorkspaceVariables(
  ctx: AppContext,
  request: Request,
  method: string,
  workspaceId: string,
  action: string,
  user: AuthUser,
): Promise<Response | undefined> {
  if (action !== 'variables') return undefined
  if (method === 'GET') return ok(await getWorkspaceVariables(ctx.db, workspaceId, user))
  if (method === 'PUT') {
    const body = await bodyOf(request)
    if (!Number.isInteger(body.baseRevision) || Number(body.baseRevision) < 0) throw new AppError('WORKSPACE_VARIABLES_INVALID')
    if (!validateWorkspaceVariables(body.variables)) throw new AppError('WORKSPACE_VARIABLES_INVALID')
    return ok(await putWorkspaceVariables(ctx, workspaceId, user, { variables: body.variables, baseRevision: Number(body.baseRevision) }))
  }
  return undefined
}
