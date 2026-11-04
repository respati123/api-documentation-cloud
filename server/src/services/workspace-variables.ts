import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { emptyWorkspaceVariables, parseJson, parseSnapshot, sanitizeWorkspaceVariables } from '@/lib/validation'
import type { AuthUser, Role, WorkspaceVariables } from '@/models/workspace'
import { findHeadSnapshotText, findVariablesRow, writeVariablesRow, type StoredVariables } from '@/repositories/workspace-variables.repository'
import { lockWorkspaceHead } from '@/repositories/workspaces.repository'
import { broadcastWorkspaceChange } from '@/services/events'
import { requireRole } from '@/services/access'

const readerRoles: Role[] = ['owner', 'editor', 'viewer']
const writerRoles: Role[] = ['owner', 'editor']

// A workspace with no variables row reads its variables from the head, at revision 0.
async function currentVariables(db: SQL, workspaceId: string): Promise<StoredVariables> {
  const row = await findVariablesRow(db, workspaceId)
  if (row) return row
  const text = await findHeadSnapshotText(db, workspaceId)
  if (text === undefined) return { variables: emptyWorkspaceVariables(), revision: 0 }
  return { variables: parseSnapshot(parseJson<unknown>(text, [])).variables, revision: 0 }
}

export async function getWorkspaceVariables(db: SQL, workspaceId: string, user: AuthUser): Promise<StoredVariables> {
  await requireRole(db, workspaceId, user.id, readerRoles)
  return currentVariables(db, workspaceId)
}

// Saves the variables when the caller read the revision that is still current. Secret values are stored without their value.
export async function putWorkspaceVariables(
  ctx: AppContext,
  workspaceId: string,
  user: AuthUser,
  input: { variables: WorkspaceVariables; baseRevision: number },
): Promise<StoredVariables> {
  await requireRole(ctx.db, workspaceId, user.id, writerRoles)
  const saved = await ctx.db.begin(async (tx) => {
    if (!(await lockWorkspaceHead(tx, workspaceId))) throw new AppError('WORKSPACE_NOT_FOUND')
    const current = await currentVariables(tx, workspaceId)
    const refused = () => new AppError('VARIABLES_REVISION_CONFLICT', { details: { revision: current.revision } })
    if (current.revision !== input.baseRevision) throw refused()
    const next = { variables: sanitizeWorkspaceVariables(input.variables), revision: current.revision + 1 }
    if (!(await writeVariablesRow(tx, workspaceId, { ...next, user }, current.revision))) throw refused()
    return next
  })
  await broadcastWorkspaceChange(ctx, workspaceId, 'settings')
  return saved
}
