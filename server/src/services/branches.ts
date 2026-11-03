import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { parseSnapshot, validateTree } from '@/lib/validation'
import type { AuthUser, Role } from '@/models/workspace'
import { findCommitById, findCommitInWorkspace, insertCommit, listCommitsPage, type CommitListRow } from '@/repositories/commits.repository'
import { countBranches, findBranch, insertBranch, listBranches, lockBranch, setBranchHead, type BranchRecord } from '@/repositories/branches.repository'
import { lockWorkspaceHead } from '@/repositories/workspaces.repository'
import { requireRole } from '@/services/access'

const readerRoles: Role[] = ['owner', 'editor', 'viewer']
const writerRoles: Role[] = ['owner', 'editor']
const maxNameLength = 60
const mainName = 'main'

export interface BranchPushCommit {
  id: string
  parentIds: unknown[]
  message: string
  tree: unknown
}

// A branch commit holds one collection: a tree with exactly one top-level node, whose id is the branch's collection key.
function isCollectionTree(tree: unknown, collectionKey: string): boolean {
  return validateTree(tree) && tree.length === 1 && tree[0].id === collectionKey
}

// The first time a workspace uses branches, its current head is split into one main branch per top-level node.
// The split is attributed to the owner, so a viewer who lists branches does not become the author of the split.
export async function ensureCollectionBranches(db: SQL, workspaceId: string): Promise<void> {
  await db.begin(async (tx) => {
    const workspace = await lockWorkspaceHead(tx, workspaceId)
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    if ((await countBranches(tx, workspaceId)) > 0) return
    const [owner] = await tx`SELECT owner_id AS "ownerId" FROM workspaces WHERE id = ${workspaceId}`
    const head = workspace.headCommitId ? await findCommitInWorkspace(tx, workspaceId, workspace.headCommitId) : undefined
    const nodes = head ? parseSnapshot(head.snapshot).tree : []
    for (const node of nodes) {
      const branchId = randomUUID()
      const collectionKey = String(node.id)
      await insertBranch(tx, { id: branchId, workspaceId, collectionKey, name: mainName, headCommitId: null, createdBy: String(owner.ownerId) })
      const commitId = randomUUID()
      await insertCommit(tx, {
        id: commitId,
        workspaceId,
        authorId: String(owner.ownerId),
        parentIds: head ? [head.id] : [],
        message: `Split ${collectionKey} into its own branch`,
        snapshot: { tree: [node] },
        branchId,
      })
      await setBranchHead(tx, branchId, commitId)
    }
  })
}

export async function listBranchesFor(db: SQL, workspaceId: string, user: AuthUser): Promise<BranchRecord[]> {
  await requireRole(db, workspaceId, user.id, readerRoles)
  await ensureCollectionBranches(db, workspaceId)
  return listBranches(db, workspaceId)
}

export async function createBranch(db: SQL, workspaceId: string, user: AuthUser, input: { collectionKey: string; name: string; fromBranchId?: string | null }): Promise<BranchRecord> {
  await requireRole(db, workspaceId, user.id, writerRoles)
  const name = input.name.trim()
  if (!name || name.length > maxNameLength) throw new AppError('BRANCH_NAME_INVALID')
  await ensureCollectionBranches(db, workspaceId)
  const branches = await listBranches(db, workspaceId)
  const sameCollection = branches.filter((branch) => branch.collectionKey === input.collectionKey)
  const main = sameCollection.find((branch) => branch.name === mainName)
  if (!main) throw new AppError('BRANCH_COLLECTION_NOT_FOUND')
  const source = input.fromBranchId ? sameCollection.find((branch) => branch.id === input.fromBranchId) : main
  if (!source) throw new AppError('BRANCH_NOT_FOUND')
  if (sameCollection.some((branch) => branch.name === name)) throw new AppError('BRANCH_NAME_TAKEN')
  const id = randomUUID()
  await insertBranch(db, { id, workspaceId, collectionKey: input.collectionKey, name, headCommitId: source.headCommitId, createdBy: user.id })
  const created = await findBranch(db, workspaceId, id)
  if (!created) throw new AppError('BRANCH_NOT_FOUND')
  return created
}

// The collection as it is at the branch head.
export async function pullBranch(db: SQL, workspaceId: string, branchId: string, user: AuthUser) {
  await requireRole(db, workspaceId, user.id, readerRoles)
  await ensureCollectionBranches(db, workspaceId)
  const branch = await findBranch(db, workspaceId, branchId)
  if (!branch) throw new AppError('BRANCH_NOT_FOUND')
  const head = branch.headCommitId ? await findCommitInWorkspace(db, workspaceId, branch.headCommitId) : undefined
  return {
    branch: { id: branch.id, collectionKey: branch.collectionKey, name: branch.name },
    headCommitId: branch.headCommitId,
    tree: head ? parseSnapshot(head.snapshot).tree : [],
  }
}

export async function branchHistoryPage(db: SQL, workspaceId: string, branchId: string, user: AuthUser, limit: number, cursor: CursorKeys | null) {
  await requireRole(db, workspaceId, user.id, readerRoles)
  await ensureCollectionBranches(db, workspaceId)
  if (!(await findBranch(db, workspaceId, branchId))) throw new AppError('BRANCH_NOT_FOUND')
  const after = cursorValues(cursor, ['t', 'i'])
  const rows = await listCommitsPage(db, { workspaceId, branchId, after: after ? { sortAt: after.t, id: after.i } : null, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
  return { items: page.items.map(withoutSortAt), nextCursor: page.nextCursor }
}

// Accepts commits that start from the branch head. Commits accepted before a conflict stay saved, as the workspace push does.
export async function pushBranch(db: SQL, workspaceId: string, branchId: string, user: AuthUser, commits: BranchPushCommit[]): Promise<string | null> {
  await requireRole(db, workspaceId, user.id, writerRoles)
  await ensureCollectionBranches(db, workspaceId)
  const result = await db.begin(async (tx) => {
    const branch = await lockBranch(tx, workspaceId, branchId)
    if (!branch) throw new AppError('BRANCH_NOT_FOUND')
    let headId = branch.headCommitId
    for (const commit of commits) {
      if (!isCollectionTree(commit.tree, branch.collectionKey)) throw new AppError('PUSH_COMMIT_INVALID')
      const parents = commit.parentIds as string[]
      if (headId && !parents.includes(headId)) return { conflict: await remoteConflict(tx, headId) }
      if (!headId && parents.length > 0) return { conflict: null }
      await insertCommit(tx, { id: commit.id, workspaceId, authorId: user.id, parentIds: parents, message: commit.message, snapshot: { tree: commit.tree }, branchId })
      headId = commit.id
      await setBranchHead(tx, branchId, headId)
    }
    return { headId }
  })
  if ('conflict' in result) throw new AppError('SYNC_REMOTE_ADVANCED', { details: { remote: result.conflict } })
  return result.headId
}

async function remoteConflict(tx: SQL, headId: string) {
  const remote = await findCommitById(tx, headId)
  if (!remote) return null
  return { id: remote.id, parentIds: remote.parentIds, message: remote.message, createdAt: remote.createdAt, ...parseSnapshot(remote.snapshot) }
}

function withoutSortAt({ sortAt: _sortAt, ...commit }: CommitListRow) {
  return commit
}
