import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { cursorValues, encodeCursor, pageOf, type CursorKeys } from '@/lib/pagination'
import { sanitizeWorkspaceVariables, validateTree, validateWorkspaceVariables } from '@/lib/validation'
import type { AuthUser, Role, TreeNode, WorkspaceVariables } from '@/models/workspace'
import { insertCommit } from '@/repositories/commits.repository'
import { insertMembership } from '@/repositories/memberships.repository'
import {
  deleteWorkspace as deleteWorkspaceRow,
  findWorkspaceForMember,
  findWorkspaceSummary,
  insertWorkspace,
  listWorkspacesPage as listWorkspaceRows,
  renameWorkspace as renameWorkspaceRow,
  type WorkspaceListRow,
} from '@/repositories/workspaces.repository'
import { broadcastWorkspaceChange } from '@/services/events'

export async function createWorkspace(db: SQL, user: AuthUser, name: string, snapshot: TreeNode[], variables: WorkspaceVariables) {
  if (!name.trim() || name.trim().length > 100) throw new AppError('WORKSPACE_NAME_INVALID')
  if (!validateTree(snapshot) || !validateWorkspaceVariables(variables)) throw new AppError('WORKSPACE_SNAPSHOT_INVALID')
  variables = sanitizeWorkspaceVariables(variables)
  const workspaceId = randomUUID()
  const commitId = randomUUID()
  await db.begin(async (tx) => {
    await insertWorkspace(tx, { id: workspaceId, name: name.trim(), ownerId: user.id, headCommitId: commitId })
    await insertMembership(tx, { workspaceId, userId: user.id, role: 'owner' })
    await insertCommit(tx, { id: commitId, workspaceId, authorId: user.id, parentIds: [], message: 'Workspace created', snapshot: { tree: snapshot, variables } })
  })
  return { id: workspaceId, name: name.trim(), role: 'owner' as Role, headCommitId: commitId, tree: snapshot, variables }
}

export async function listWorkspacesPage(db: SQL, userId: string, limit: number, cursor: CursorKeys | null) {
  const after = cursorValues(cursor, ['t', 'i'])
  const rows = await listWorkspaceRows(db, { userId, after: after ? { sortAt: after.t, id: after.i } : null, limit: limit + 1 })
  const page = pageOf(rows, limit, (row) => encodeCursor({ t: row.sortAt, i: row.id }))
  return { items: page.items.map(withoutSortAt), nextCursor: page.nextCursor }
}

export async function renameWorkspace(ctx: AppContext, user: AuthUser, workspaceId: string, name: string) {
  if (!name || name.length > 100) throw new AppError('WORKSPACE_NAME_INVALID')
  await renameWorkspaceRow(ctx.db, workspaceId, name)
  await broadcastWorkspaceChange(ctx, workspaceId, 'settings')
  const workspace = await findWorkspaceForMember(ctx.db, workspaceId, user.id)
  if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
  return workspace
}

// The name must be typed back to confirm. Open pages hear about the delete before the row is gone.
export async function deleteWorkspace(ctx: AppContext, workspaceId: string, confirmName: unknown): Promise<void> {
  const workspace = await findWorkspaceSummary(ctx.db, workspaceId)
  if (!workspace) throw new AppError('WORKSPACE_NOT_FOUND')
  if (typeof confirmName !== 'string' || confirmName.trim() !== workspace.name) throw new AppError('WORKSPACE_DELETE_CONFIRMATION_MISMATCH')
  await broadcastWorkspaceChange(ctx, workspaceId, 'deleted')
  await deleteWorkspaceRow(ctx.db, workspaceId)
}

function withoutSortAt({ sortAt: _sortAt, ...workspace }: WorkspaceListRow) {
  return workspace
}
