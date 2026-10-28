import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import { emptyWorkspaceVariables, validateTree, validateWorkspaceVariables } from '@/lib/validation'
import { createWorkspace, listWorkspacesPage } from '@/services/workspaces'

export async function handleWorkspaceCollection(ctx: AppContext, request: Request, url: URL, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
  if (method === 'GET' && path === '/api/workspaces') {
    const page = await listWorkspacesPage(db, user.id, readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ workspaces: page.items }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && path === '/api/workspaces') {
    const body = await bodyOf(request)
    const tree = body.tree === undefined ? [] : body.tree
    const variables = body.variables === undefined ? emptyWorkspaceVariables() : body.variables
    if (!validateTree(tree)) throw new AppError('WORKSPACE_TREE_INVALID')
    if (!validateWorkspaceVariables(variables)) throw new AppError('WORKSPACE_VARIABLES_INVALID')
    return created({ workspace: await createWorkspace(db, user, String(body.name || ''), tree, variables) })
  }
  return undefined
}
