import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import { isProjectKey } from '@/models/project-key'
import {
  deleteKeyAlias,
  findProjectSettings,
  insertKeyAlias,
  keyOwner,
  type ProjectSettings,
  updateProjectRow,
} from '@/repositories/project-settings.repository'
import { type Actor, isAgent, type IssueScope } from '@/services/issues'
import { resolveProjectRoles } from '@/services/project-roles'

export interface ProjectSettingsInput {
  key?: string
  mode?: 'scrum' | 'kanban'
  productGoal?: string
}

const invalid = () => new AppError('PROJECT_INPUT_INVALID')

// The PM sets the key, the Product Goal, and the mode. The key that is given up stays as an alias, so old links still open.
export async function updateProjectSettings(db: SQL, scope: IssueScope, actor: Actor, patch: ProjectSettingsInput): Promise<ProjectSettings> {
  const roles = await resolveProjectRoles(db, scope.workspaceId, scope.projectId, actor.userId)
  if (!roles.isPm) throw new AppError('ROLE_NOT_ALLOWED')
  if (isAgent(actor)) throw new AppError('ISSUE_AGENT_FORBIDDEN')
  const current = (await findProjectSettings(db, scope.projectId)) as ProjectSettings

  if (patch.key !== undefined && !isProjectKey(patch.key)) throw invalid()
  if (patch.mode !== undefined && patch.mode !== 'scrum' && patch.mode !== 'kanban') throw invalid()
  const goal = patch.productGoal === undefined ? undefined : text(patch.productGoal, 2000)

  await db.begin(async (tx) => {
    if (patch.key !== undefined && patch.key !== current.key) {
      const owner = await keyOwner(tx, scope.workspaceId, patch.key)
      if (owner && owner !== scope.projectId) throw new AppError('PROJECT_KEY_TAKEN')
      await insertKeyAlias(tx, { workspaceId: scope.workspaceId, key: current.key, projectId: scope.projectId })
      await deleteKeyAlias(tx, scope.workspaceId, patch.key)
    }
    await updateProjectRow(tx, scope.projectId, { key: patch.key, mode: patch.mode, productGoal: goal })
  })
  return (await findProjectSettings(db, scope.projectId)) as ProjectSettings
}

function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.trim().length > max) throw invalid()
  return value.trim()
}
