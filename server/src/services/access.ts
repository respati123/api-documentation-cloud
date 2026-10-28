import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { Role } from '@/models/workspace'

// Every workspace route calls this first. A missing membership is reported as not found, so a stranger cannot tell the workspace exists.
export async function requireRole(db: SQL, workspaceId: string, userId: string, allowed: Role[]): Promise<Role> {
  const [membership] = await db`SELECT role FROM memberships WHERE workspace_id = ${workspaceId} AND user_id = ${userId}`
  if (!membership) throw new AppError('WORKSPACE_NOT_FOUND')
  const role = membership.role as Role
  if (!allowed.includes(role)) throw new AppError('ROLE_NOT_ALLOWED')
  return role
}
