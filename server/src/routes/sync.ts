import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import { emptyWorkspaceVariables, validateTree, validateWorkspaceVariables } from '@/lib/validation'
import { requireRole } from '@/services/access'
import { commitDetail, historyPage, pullWorkspace, pushCommits, restoreCommit, type PushCommit } from '@/services/sync'

export async function handleSync(ctx: AppContext, request: Request, url: URL, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  const { db } = ctx
  if (method === 'GET' && action === 'sync/pull') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    return ok({ workspace: await pullWorkspace(db, workspaceId, user.id) })
  }

  if (method === 'GET' && action === 'sync/history') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    const page = await historyPage(db, workspaceId, readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ commits: page.items }, { nextCursor: page.nextCursor })
  }

  const historyCommitMatch = action.match(/^sync\/history\/([\w-]+)$/)

  if (method === 'GET' && historyCommitMatch) {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor', 'viewer'])
    return ok({ commit: await commitDetail(db, workspaceId, historyCommitMatch[1]) })
  }

  const restoreMatch = action.match(/^sync\/restore\/([\w-]+)$/)

  if (method === 'POST' && restoreMatch) {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor'])
    return created({ headCommitId: await restoreCommit(ctx, workspaceId, user, restoreMatch[1]) })
  }

  if (method === 'POST' && action === 'sync/push') {
    await requireRole(db, workspaceId, user.id, ['owner', 'editor'])
    const body = await bodyOf(request)
    if (!Array.isArray(body.commits) || body.commits.length === 0 || body.commits.length > 100) throw new AppError('PUSH_COMMITS_COUNT_INVALID')
    const commits = body.commits as Record<string, unknown>[]
    for (const commit of commits) {
      const variables = commit.variables === undefined ? emptyWorkspaceVariables() : commit.variables
      if (typeof commit.id !== 'string' || !Array.isArray(commit.parentIds) || typeof commit.message !== 'string' || !validateTree(commit.tree) || !validateWorkspaceVariables(variables)) throw new AppError('PUSH_COMMIT_INVALID')
    }
    const pushed: PushCommit[] = commits.map((commit) => ({
      id: commit.id as string,
      parentIds: commit.parentIds as unknown[],
      message: commit.message as string,
      tree: commit.tree,
      variables: commit.variables,
    }))
    return created({ headCommitId: await pushCommits(ctx, workspaceId, user, pushed) })
  }
  return undefined
}
