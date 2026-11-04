import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { parseSnapshot, validateTree } from '@/lib/validation'
import type { AuthUser, Role } from '@/models/workspace'
import { commitIdUsedElsewhere, findCommitInWorkspace, insertCommit, listCommitsPage, type CommitListRow } from '@/repositories/commits.repository'
import { countBranches, findBranch, insertBranch, listBranches, lockBranch, setBranchHead, softDeleteCollectionBranches, type BranchRecord } from '@/repositories/branches.repository'
import { findWorkspaceOwnerId, lockWorkspaceHead } from '@/repositories/workspaces.repository'
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

// Splits the current head into one main branch per top-level node. Runs once; later calls change nothing.
// The split is attributed to the owner.
async function ensureCollectionBranches(db: SQL, workspaceId: string): Promise<void> {
  await db.begin(async (tx) => {
    const workspace = await lockWorkspaceHead(tx, workspaceId)
    if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
    if ((await countBranches(tx, workspaceId)) > 0) return
    const ownerId = await findWorkspaceOwnerId(tx, workspaceId)
    if (!ownerId) throw new AppError('WORKSPACE_NOT_FOUND')
    const head = workspace.headCommitId ? await findCommitInWorkspace(tx, workspaceId, workspace.headCommitId) : undefined
    const nodes = head ? parseSnapshot(head.snapshot).tree : []
    for (const node of nodes) {
      const branchId = randomUUID()
      const collectionKey = String(node.id)
      await insertBranch(tx, { id: branchId, workspaceId, collectionKey, name: mainName, headCommitId: null, createdBy: ownerId })
      const commitId = randomUUID()
      await insertCommit(tx, {
        id: commitId,
        workspaceId,
        authorId: ownerId,
        parentIds: head ? [head.id] : [],
        message: `Split ${collectionKey} into its own branch`,
        snapshot: { tree: [node] },
        branchId,
      })
      await setBranchHead(tx, branchId, commitId)
    }
  })
}

// Only the owner can turn branches on. Reading never splits a workspace, so a read by any member cannot change how it syncs.
export async function enableCollectionBranches(db: SQL, workspaceId: string, user: AuthUser): Promise<void> {
  await requireRole(db, workspaceId, user.id, ['owner'])
  await ensureCollectionBranches(db, workspaceId)
}

// Deletes a collection from the workspace. Its branches stay in the database, so the history is kept, but nothing lists or uses them.
export async function deleteCollectionBranch(db: SQL, workspaceId: string, user: AuthUser, collectionKey: string): Promise<void> {
  await requireRole(db, workspaceId, user.id, writerRoles)
  if ((await softDeleteCollectionBranches(db, workspaceId, collectionKey)) === 0) throw new AppError('BRANCH_COLLECTION_NOT_FOUND')
}

// Adds a main branch for a collection that has none yet, so its first commit can be pushed.
export async function addCollectionBranch(db: SQL, workspaceId: string, user: AuthUser, collectionKey: string): Promise<BranchRecord> {
  await requireRole(db, workspaceId, user.id, writerRoles)
  if (!collectionKey.trim()) throw new AppError('BRANCH_NAME_INVALID')
  if ((await countBranches(db, workspaceId)) === 0) throw new AppError('BRANCHES_NOT_ENABLED')
  if ((await listBranches(db, workspaceId)).some((branch) => branch.collectionKey === collectionKey)) throw new AppError('BRANCH_NAME_TAKEN')
  const id = randomUUID()
  await insertBranch(db, { id, workspaceId, collectionKey, name: mainName, headCommitId: null, createdBy: user.id })
  const created = await findBranch(db, workspaceId, id)
  if (!created) throw new AppError('BRANCH_NOT_FOUND')
  return created
}

export async function listBranchesFor(db: SQL, workspaceId: string, user: AuthUser): Promise<BranchRecord[]> {
  await requireRole(db, workspaceId, user.id, readerRoles)
  return listBranches(db, workspaceId)
}

export async function createBranch(db: SQL, workspaceId: string, user: AuthUser, input: { collectionKey: string; name: string; fromBranchId?: string | null }): Promise<BranchRecord> {
  await requireRole(db, workspaceId, user.id, writerRoles)
  const name = input.name.trim()
  if (!name || name.length > maxNameLength) throw new AppError('BRANCH_NAME_INVALID')
  if ((await countBranches(db, workspaceId)) === 0) throw new AppError('BRANCHES_NOT_ENABLED')
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
  if (!(await findBranch(db, workspaceId, branchId))) throw new AppError('BRANCH_NOT_FOUND')
  const after = cursorValues(cursor, ['t', 'i'])
  const rows = await listCommitsPage(db, { workspaceId, branchId, after: after ? { sortAt: after.t, id: after.i } : null, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
  return { items: page.items.map(withoutSortAt), nextCursor: page.nextCursor }
}

// Accepts commits that start from the branch head. Commits accepted before a conflict stay saved, as the workspace push does.
export async function pushBranch(db: SQL, workspaceId: string, branchId: string, user: AuthUser, commits: BranchPushCommit[]): Promise<string | null> {
  await requireRole(db, workspaceId, user.id, writerRoles)
  const result = await db.begin(async (tx) => {
    const branch = await lockBranch(tx, workspaceId, branchId)
    if (!branch) throw new AppError('BRANCH_NOT_FOUND')
    let headId = branch.headCommitId
    for (const commit of commits) {
      if (!isCollectionTree(commit.tree, branch.collectionKey)) throw new AppError('PUSH_COMMIT_INVALID')
      const parents = commit.parentIds as string[]
      if (headId && !parents.includes(headId)) return { conflict: await remoteConflict(tx, workspaceId, headId) }
      if (!headId && parents.length > 0) return { conflict: null }
      if (await commitIdUsedElsewhere(tx, { id: commit.id, workspaceId, branchId })) throw new AppError('PUSH_COMMIT_INVALID')
      await insertCommit(tx, { id: commit.id, workspaceId, authorId: user.id, parentIds: parents, message: commit.message, snapshot: { tree: commit.tree }, branchId })
      headId = commit.id
      await setBranchHead(tx, branchId, headId)
    }
    return { headId }
  })
  if ('conflict' in result) throw new AppError('SYNC_REMOTE_ADVANCED', { details: { remote: result.conflict } })
  return result.headId
}

async function remoteConflict(tx: SQL, workspaceId: string, headId: string) {
  const remote = await findCommitInWorkspace(tx, workspaceId, headId)
  if (!remote) return null
  return { id: remote.id, parentIds: remote.parentIds, message: remote.message, createdAt: remote.createdAt, ...parseSnapshot(remote.snapshot) }
}

function withoutSortAt({ sortAt: _sortAt, ...commit }: CommitListRow) {
  return commit
}
