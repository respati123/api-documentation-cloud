import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { Role } from '@/models/workspace'
import { listProjectDisciplines } from '@/repositories/planning-audience.repository'
import { isProjectInWorkspace } from '@/repositories/projects.repository'
import { resolveAccess } from '@/services/access'

export interface ProjectRoles {
  workspaceRole: Role
  viaAdmin: boolean
  disciplines: string[]
  isPm: boolean
  isTechLead: boolean
  isApprover: boolean
}

// What the caller may do in one project. A role given in another project counts for nothing here.
// The workspace owner is PM and approver everywhere. A viewer, and an app admin who is not a member, only read.
export async function resolveProjectRoles(db: SQL, workspaceId: string, projectId: string, userId: string): Promise<ProjectRoles> {
  const access = await resolveAccess(db, workspaceId, userId)
  if (!access) throw new AppError('WORKSPACE_NOT_FOUND')
  if (!(await isProjectInWorkspace(db, projectId, workspaceId))) throw new AppError('PROJECT_NOT_FOUND')
  const disciplines = await listProjectDisciplines(db, projectId, userId)
  const base = { workspaceRole: access.role, viaAdmin: access.viaAdmin, disciplines }
  if (access.role === 'owner') return { ...base, isPm: true, isTechLead: true, isApprover: true }
  if (access.role === 'viewer') return { ...base, isPm: false, isTechLead: false, isApprover: false }
  const isPm = disciplines.includes('pm')
  const isTechLead = disciplines.includes('tech_lead')
  return { ...base, isPm, isTechLead, isApprover: isPm || isTechLead }
}
