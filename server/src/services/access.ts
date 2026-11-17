import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { Role } from '@/models/workspace'
import { findRole } from '@/repositories/memberships.repository'
import { isAdminUser } from '@/repositories/users.repository'
import { findWorkspaceSummary } from '@/repositories/workspaces.repository'

// `viaAdmin` is true when the caller is the app admin and not a member. The admin then reads the workspace as a viewer,
// is not listed as a member, and cannot write: the router refuses every other method than GET.
export interface WorkspaceAccess {
  role: Role
  viaAdmin: boolean
}

export async function resolveAccess(db: SQL, workspaceId: string, userId: string): Promise<WorkspaceAccess | undefined> {
  const role = await findRole(db, workspaceId, userId)
  if (role) return { role, viaAdmin: false }
  if ((await isAdminUser(db, userId)) && (await findWorkspaceSummary(db, workspaceId))) return { role: 'viewer', viaAdmin: true }
  return undefined
}

// Every workspace route calls this first. A missing membership is reported as not found, so a stranger cannot tell the workspace exists.
export async function requireAccess(db: SQL, workspaceId: string, userId: string, allowed: Role[]): Promise<WorkspaceAccess> {
  const access = await resolveAccess(db, workspaceId, userId)
  if (!access) throw new AppError('WORKSPACE_NOT_FOUND')
  if (!allowed.includes(access.role)) throw new AppError('ROLE_NOT_ALLOWED')
  return access
}

export async function requireRole(db: SQL, workspaceId: string, userId: string, allowed: Role[]): Promise<Role> {
  return (await requireAccess(db, workspaceId, userId, allowed)).role
}

// The admin's access to a workspace they are not a member of is read only.
export async function refuseAdminWrite(db: SQL, workspaceId: string, userId: string): Promise<void> {
  if ((await resolveAccess(db, workspaceId, userId))?.viaAdmin) throw new AppError('ROLE_NOT_ALLOWED')
}
