import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { createWorkspace } from '@/services/workspaces'
import { created, ok } from '@/lib/http'
import { cursorText, decodeCursor, encodeCursor, pageOf, readLimit } from '@/lib/pagination'
import { emptyWorkspaceVariables, validateTree, validateWorkspaceVariables } from '@/lib/validation'


export async function handleWorkspaceCollection(ctx: AppContext, request: Request, url: URL, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
  if (method === 'GET' && path === '/api/workspaces') {
    const limit = readLimit(url)
    const cursor = decodeCursor(url.searchParams.get('cursor'))
    const cursorAt = cursorText(cursor, 't')
    const cursorId = cursorText(cursor, 'i')
    const rows: Array<{ id: string; name: string; role: string; headCommitId: string | null; createdAt: Date; updatedAt: Date | null; sortAt: string }> = await db`SELECT * FROM (SELECT w.id, w.name, m.role, w.head_commit_id AS "headCommitId", w.created_at AS "createdAt", c.created_at AS "updatedAt", COALESCE(c.created_at, w.created_at)::text AS "sortAt" FROM workspaces w JOIN memberships m ON m.workspace_id = w.id LEFT JOIN commits c ON c.id = w.head_commit_id WHERE m.user_id = ${user.id}) q WHERE ${cursorAt}::text IS NULL OR (q."sortAt"::timestamptz, q.id) < (${cursorAt}::timestamptz, ${cursorId}::text) ORDER BY q."sortAt"::timestamptz DESC, q.id DESC LIMIT ${limit + 1}`
    const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
    return ok({ workspaces: page.items.map(({ sortAt: _sortAt, ...workspace }) => workspace) }, { nextCursor: page.nextCursor })
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
