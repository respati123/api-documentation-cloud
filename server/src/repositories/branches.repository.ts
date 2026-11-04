import type { SQL } from 'bun'

export interface BranchRecord {
  id: string
  workspaceId: string
  collectionKey: string
  name: string
  headCommitId: string | null
  createdBy: string
  createdAt: Date
}

type BranchRow = { id: unknown; workspaceId: unknown; collectionKey: unknown; name: unknown; headCommitId: unknown; createdBy: unknown; createdAt: Date }

function toRecord(row: BranchRow): BranchRecord {
  return {
    id: String(row.id),
    workspaceId: String(row.workspaceId),
    collectionKey: String(row.collectionKey),
    name: String(row.name),
    headCommitId: row.headCommitId === null ? null : String(row.headCommitId),
    createdBy: String(row.createdBy),
    createdAt: row.createdAt,
  }
}

export async function listBranches(db: SQL, workspaceId: string): Promise<BranchRecord[]> {
  const rows: BranchRow[] = await db`SELECT id, workspace_id AS "workspaceId", collection_key AS "collectionKey", name, head_commit_id AS "headCommitId", created_by AS "createdBy", created_at AS "createdAt" FROM collection_branches WHERE workspace_id = ${workspaceId} AND deleted_at IS NULL ORDER BY collection_key, created_at, id`
  return rows.map(toRecord)
}

export async function countBranches(db: SQL, workspaceId: string): Promise<number> {
  const [row] = await db`SELECT COUNT(*)::int AS total FROM collection_branches WHERE workspace_id = ${workspaceId}`
  return Number(row.total)
}

export async function findBranch(db: SQL, workspaceId: string, branchId: string): Promise<BranchRecord | undefined> {
  const [row]: BranchRow[] = await db`SELECT id, workspace_id AS "workspaceId", collection_key AS "collectionKey", name, head_commit_id AS "headCommitId", created_by AS "createdBy", created_at AS "createdAt" FROM collection_branches WHERE workspace_id = ${workspaceId} AND id = ${branchId} AND deleted_at IS NULL`
  return row ? toRecord(row) : undefined
}

// Locks the branch row, so two pushes to the same branch cannot both advance its head.
export async function lockBranch(db: SQL, workspaceId: string, branchId: string): Promise<BranchRecord | undefined> {
  const [row]: BranchRow[] = await db`SELECT id, workspace_id AS "workspaceId", collection_key AS "collectionKey", name, head_commit_id AS "headCommitId", created_by AS "createdBy", created_at AS "createdAt" FROM collection_branches WHERE workspace_id = ${workspaceId} AND id = ${branchId} AND deleted_at IS NULL FOR UPDATE`
  return row ? toRecord(row) : undefined
}

export async function insertBranch(
  db: SQL,
  branch: { id: string; workspaceId: string; collectionKey: string; name: string; headCommitId: string | null; createdBy: string },
): Promise<void> {
  await db`INSERT INTO collection_branches (id, workspace_id, collection_key, name, head_commit_id, created_by) VALUES (${branch.id}, ${branch.workspaceId}, ${branch.collectionKey}, ${branch.name}, ${branch.headCommitId}, ${branch.createdBy})`
}

export async function setBranchHead(db: SQL, branchId: string, commitId: string): Promise<void> {
  await db`UPDATE collection_branches SET head_commit_id = ${commitId} WHERE id = ${branchId}`
}

// Marks every live branch of a collection as deleted. The branches and their commits stay in the database.
export async function softDeleteCollectionBranches(db: SQL, workspaceId: string, collectionKey: string): Promise<number> {
  const rows = await db`UPDATE collection_branches SET deleted_at = now() WHERE workspace_id = ${workspaceId} AND collection_key = ${collectionKey} AND deleted_at IS NULL RETURNING id`
  return rows.length
}
