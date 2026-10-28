import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { sanitizeWorkspaceVariables, validateTree, validateWorkspaceVariables } from '@/lib/validation'
import type { AuthUser, Role, TreeNode, WorkspaceVariables } from '@/models/workspace'

export async function createWorkspace(db: SQL, user: AuthUser, name: string, snapshot: TreeNode[], variables: WorkspaceVariables) {
  if (!name.trim() || name.trim().length > 100) throw new AppError('WORKSPACE_NAME_INVALID')
  if (!validateTree(snapshot) || !validateWorkspaceVariables(variables)) throw new AppError('WORKSPACE_SNAPSHOT_INVALID')
  variables = sanitizeWorkspaceVariables(variables)
  const workspaceId = randomUUID()
  const commitId = randomUUID()
  await db.begin(async (tx) => {
    await tx`INSERT INTO workspaces (id, name, owner_id, head_commit_id) VALUES (${workspaceId}, ${name.trim()}, ${user.id}, ${commitId})`
    await tx`INSERT INTO memberships (workspace_id, user_id, role) VALUES (${workspaceId}, ${user.id}, 'owner')`
    await tx`INSERT INTO commits (id, workspace_id, author_id, parent_ids, message, snapshot) VALUES (${commitId}, ${workspaceId}, ${user.id}, '[]'::jsonb, 'Workspace created', ${JSON.stringify({ tree: snapshot, variables })}::jsonb)`
  })
  return { id: workspaceId, name: name.trim(), role: 'owner' as Role, headCommitId: commitId, tree: snapshot, variables }
}
