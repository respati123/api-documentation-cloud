import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { Role } from '@/models/workspace'
import { findRole } from '@/repositories/memberships.repository'

// Every workspace route calls this first. A missing membership is reported as not found, so a stranger cannot tell the workspace exists.
export async function requireRole(db: SQL, workspaceId: string, userId: string, allowed: Role[]): Promise<Role> {
  const role = await findRole(db, workspaceId, userId)
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  if (!allowed.includes(role)) throw new AppError('ROLE_NOT_ALLOWED')
  return role
}
