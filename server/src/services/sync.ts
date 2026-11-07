import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { emptyWorkspaceVariables, parseJson, parseSnapshot, sanitizeWorkspaceVariables, validateTree } from '@/lib/validation'
import type { AuthUser, WorkspaceVariables } from '@/models/workspace'
import { commitIdUsedElsewhere, findCommitInWorkspace, insertCommit, listCommitsPage, type CommitListRow, type CommitRecord } from '@/repositories/commits.repository'
import { countBranches } from '@/repositories/branches.repository'
import { findWorkspaceSnapshotRow, lockWorkspaceHead, setWorkspaceHead } from '@/repositories/workspaces.repository'
import { type ChangeSummary, summarizeChanges } from '@/services/change-summary'
import { broadcastWorkspaceUpdate } from '@/services/events'

export async function pullWorkspace(db: SQL, workspaceId: string, userId: string) {
  const row = await findWorkspaceSnapshotRow(db, workspaceId, userId)
  if (!row) throw new AppError('WORKSPACE_NOT_FOUND')
  const { snapshot, parentIds, ...workspace } = row
  // A client that still syncs through the head uses this to see that the collections now sync by branch.
  const usesBranches = (await countBranches(db, workspaceId)) > 0
  return { ...workspace, parentIds: parseJson<string[]>(parentIds, []), usesBranches, ...parseSnapshot(parseJson<unknown>(snapshot, [])) }
}

export async function historyPage(db: SQL, workspaceId: string, limit: number, cursor: CursorKeys | null) {
  const after = cursorValues(cursor, ['t', 'i'])
  const rows = await listCommitsPage(db, { workspaceId, after: after ? { sortAt: after.t, id: after.i } : null, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
  return { items: page.items.map(withoutSortAt), nextCursor: page.nextCursor }
}

export async function commitDetail(db: SQL, workspaceId: string, commitId: string) {
  const commit = await findCommitInWorkspace(db, workspaceId, commitId)
  if (!commit) throw new AppError('COMMIT_NOT_FOUND')
  return { id: commit.id, parentIds: commit.parentIds, message: commit.message, createdAt: commit.createdAt, ...parseSnapshot(commit.snapshot) }
}

// A restore is a new commit on top of the head, so the history keeps every version.
export async function restoreCommit(ctx: AppContext, workspaceId: string, user: AuthUser, sourceId: string): Promise<string> {
  const restored = await ctx.db.begin(async (tx) => {
    const workspace = await lockWorkspaceHead(tx, workspaceId)
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    if ((await countBranches(tx, workspaceId)) > 0) throw new AppError('WORKSPACE_USES_BRANCHES')
    if (workspace.headCommitId === sourceId) throw new AppError('VERSION_ALREADY_LATEST')
    const source = await findCommitInWorkspace(tx, workspaceId, sourceId)
    if (!source) throw new AppError('COMMIT_NOT_FOUND')
    const restoredId = randomUUID()
    const message = `Restore to ${sourceId.slice(0, 7)}`
    await insertCommit(tx, {
      id: restoredId,
      workspaceId,
      authorId: user.id,
      parentIds: workspace.headCommitId ? [workspace.headCommitId] : [],
      message,
      snapshot: parseSnapshot(source.snapshot),
    })
    await setWorkspaceHead(tx, workspaceId, restoredId)
    return { headId: restoredId, message }
  })
  await broadcastWorkspaceUpdate(ctx, workspaceId, restored.headId, restored.message, user, 1)
  return restored.headId
}

export interface PushCommit {
  id: string
  parentIds: unknown[]
  message: string
  tree: unknown
  variables?: unknown
}

// Accepts commits that start from the current head. A commit whose parents do not include the head is a conflict.
// The conflict is returned rather than thrown, so commits accepted before it stay saved, as they always have.
export async function pushCommits(ctx: AppContext, workspaceId: string, user: AuthUser, commits: PushCommit[]): Promise<string | null> {
  const result = await ctx.db.begin(async (tx) => {
    const workspace = await lockWorkspaceHead(tx, workspaceId)
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    if ((await countBranches(tx, workspaceId)) > 0) throw new AppError('WORKSPACE_USES_BRANCHES')
    let headId = workspace.headCommitId
    for (const commit of commits) {
      const parents = commit.parentIds as string[]
      if (headId && !parents.includes(headId)) return { conflict: await remoteConflict(tx, workspaceId, headId) }
      if (!headId && parents.length > 0) return { conflict: null }
      if (await commitIdUsedElsewhere(tx, { id: commit.id, workspaceId, branchId: null })) throw new AppError('PUSH_COMMIT_INVALID')
      const variables = sanitizeWorkspaceVariables(commit.variables === undefined ? emptyWorkspaceVariables() : commit.variables as WorkspaceVariables)
      await insertCommit(tx, { id: commit.id, workspaceId, authorId: user.id, parentIds: parents, message: commit.message, snapshot: { tree: commit.tree, variables } })
      headId = commit.id
      await setWorkspaceHead(tx, workspaceId, headId)
    }
    return { headId, previousId: workspace.headCommitId }
  })
  if ('conflict' in result) throw new AppError('SYNC_REMOTE_ADVANCED', { details: { remote: result.conflict } })
  if (result.headId) {
    const lastCommit = commits[commits.length - 1]
    // The commits are saved already, so a failure to list what changed must not fail the push. The event goes out without the list.
    const changes = await changeSummaryFor(ctx, workspaceId, result.previousId, lastCommit.tree).catch(() => [])
    await broadcastWorkspaceUpdate(ctx, workspaceId, result.headId, lastCommit.message, user, commits.length, changes)
  }
  return result.headId
}

// What the push changed: the tree before its first commit against the tree after its last one.
async function changeSummaryFor(ctx: AppContext, workspaceId: string, previousId: string | null, tree: unknown): Promise<ChangeSummary[]> {
  if (!validateTree(tree)) return []
  const previous = previousId ? await findCommitInWorkspace(ctx.db, workspaceId, previousId) : undefined
  return summarizeChanges(previous ? parseSnapshot(previous.snapshot).tree : [], tree)
}

async function remoteConflict(tx: SQL, workspaceId: string, headId: string) {
  const remote: CommitRecord | undefined = await findCommitInWorkspace(tx, workspaceId, headId)
  if (!remote) return null
  return { id: remote.id, parentIds: remote.parentIds, message: remote.message, createdAt: remote.createdAt, ...parseSnapshot(remote.snapshot) }
}

function withoutSortAt({ sortAt: _sortAt, ...commit }: CommitListRow) {
  return commit
}
