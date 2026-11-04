import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { AppError } from '@/lib/errors/app-error'
import { bodyOf } from '@/lib/http-body'
import { created, ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import { addCollectionBranch, branchHistoryPage, deleteCollectionBranch, createBranch, enableCollectionBranches, listBranchesFor, pullBranch, pushBranch, type BranchPushCommit } from '@/services/branches'
import { broadcastWorkspaceChange } from '@/services/events'

const maxPushCommits = 100

export async function handleBranches(
  ctx: AppContext,
  request: Request,
  url: URL,
  method: string,
  workspaceId: string,
  action: string,
  user: AuthUser,
): Promise<Response | undefined> {
  const { db } = ctx

  if (method === 'GET' && action === 'branches') {
    return ok({ branches: await listBranchesFor(db, workspaceId, user) })
  }

  if (method === 'POST' && action === 'branches/enable') {
    await enableCollectionBranches(db, workspaceId, user)
    return ok({ branches: await listBranchesFor(db, workspaceId, user) })
  }

  if (method === 'POST' && action === 'branches/collections') {
    const body = await bodyOf(request)
    if (typeof body.collectionKey !== 'string') throw new AppError('BRANCH_NAME_INVALID')
    return created({ branch: await addCollectionBranch(db, workspaceId, user, body.collectionKey) })
  }

  if (method === 'POST' && action === 'branches') {
    const body = await bodyOf(request)
    if (typeof body.collectionKey !== 'string' || typeof body.name !== 'string') throw new AppError('BRANCH_NAME_INVALID')
    const fromBranchId = typeof body.fromBranchId === 'string' ? body.fromBranchId : null
    return created({ branch: await createBranch(db, workspaceId, user, { collectionKey: body.collectionKey, name: body.name, fromBranchId }) })
  }

  const collectionMatch = action.match(/^branches\/collections\/([^/]+)$/)
  if (method === 'DELETE' && collectionMatch) {
    const collectionKey = decodeURIComponent(collectionMatch[1])
    await deleteCollectionBranch(db, workspaceId, user, collectionKey)
    return ok({ collectionKey })
  }

  const match = action.match(/^branches\/([\w-]+)\/(pull|push|history)$/)
  if (!match) return undefined
  const [, branchId, operation] = match

  if (method === 'GET' && operation === 'pull') {
    return ok(await pullBranch(db, workspaceId, branchId, user))
  }

  if (method === 'GET' && operation === 'history') {
    const page = await branchHistoryPage(db, workspaceId, branchId, user, readLimit(url), decodeCursor(url.searchParams.get('cursor')))
    return ok({ commits: page.items }, { nextCursor: page.nextCursor })
  }

  if (method === 'POST' && operation === 'push') {
    const body = await bodyOf(request)
    if (!Array.isArray(body.commits) || body.commits.length === 0 || body.commits.length > maxPushCommits) throw new AppError('PUSH_COMMITS_COUNT_INVALID')
    const commits: BranchPushCommit[] = (body.commits as Record<string, unknown>[]).map((commit) => {
      if (typeof commit.id !== 'string' || !Array.isArray(commit.parentIds) || typeof commit.message !== 'string') throw new AppError('PUSH_COMMIT_INVALID')
      return { id: commit.id, parentIds: commit.parentIds as unknown[], message: commit.message, tree: commit.tree }
    })
    const headCommitId = await pushBranch(db, workspaceId, branchId, user, commits)
    // A branch push does not move the workspace head, so the event only says that the workspace changed.
    await broadcastWorkspaceChange(ctx, workspaceId, 'settings')
    return created({ headCommitId })
  }

  return undefined
}
