import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { emptyWorkspaceVariables, parseJson, parseSnapshot, sanitizeWorkspaceVariables } from '@/lib/validation'
import type { AuthUser, WorkspaceVariables } from '@/models/workspace'
import { findCommitById, findCommitInWorkspace, insertCommit, listCommitsPage, type CommitListRow, type CommitRecord } from '@/repositories/commits.repository'
import { findWorkspaceSnapshotRow, lockWorkspaceHead, setWorkspaceHead } from '@/repositories/workspaces.repository'
import { broadcastWorkspaceUpdate } from '@/services/events'

export async function pullWorkspace(db: SQL, workspaceId: string, userId: string) {
  const row = await findWorkspaceSnapshotRow(db, workspaceId, userId)
  if (!row) throw new AppError('WORKSPACE_NOT_FOUND')
  const { snapshot, parentIds, ...workspace } = row
  return { ...workspace, parentIds: parseJson<string[]>(parentIds, []), ...parseSnapshot(parseJson<unknown>(snapshot, [])) }
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
    let headId = workspace.headCommitId
    for (const commit of commits) {
      const parents = commit.parentIds as string[]
      if (headId && !parents.includes(headId)) return { conflict: await remoteConflict(tx, headId) }
      if (!headId && parents.length > 0) return { conflict: null }
      const variables = sanitizeWorkspaceVariables(commit.variables === undefined ? emptyWorkspaceVariables() : commit.variables as WorkspaceVariables)
      await insertCommit(tx, { id: commit.id, workspaceId, authorId: user.id, parentIds: parents, message: commit.message, snapshot: { tree: commit.tree, variables } })
      headId = commit.id
      await setWorkspaceHead(tx, workspaceId, headId)
    }
    return { headId }
  })
  if ('conflict' in result) throw new AppError('SYNC_REMOTE_ADVANCED', { details: { remote: result.conflict } })
  if (result.headId) {
    const lastCommit = commits[commits.length - 1]
    await broadcastWorkspaceUpdate(ctx, workspaceId, result.headId, lastCommit.message, user, commits.length)
  }
  return result.headId
}

async function remoteConflict(tx: SQL, headId: string) {
  const remote: CommitRecord | undefined = await findCommitById(tx, headId)
  if (!remote) return null
  return { id: remote.id, parentIds: remote.parentIds, message: remote.message, createdAt: remote.createdAt, ...parseSnapshot(remote.snapshot) }
}

function withoutSortAt({ sortAt: _sortAt, ...commit }: CommitListRow) {
  return commit
}
