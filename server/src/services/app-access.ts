import type { SQL } from 'bun'
import { AppError } from '@/lib/errors/app-error'
import type { AppName } from '@/repositories/app-links.repository'
import { findRole } from '@/repositories/memberships.repository'
import { listUserDisciplines } from '@/repositories/planning-audience.repository'

// What a member may do in each app. Stitchkit: everyone who is in a workspace can open it, only UI/UX can change it.
// DBDesign: only the owner and the backend, tech lead, and PM disciplines can use it at all.
export type AppRole = 'editor' | 'viewer' | 'none'

const DBDESIGN_DISCIPLINES = ['backend', 'tech_lead', 'pm'] as const
const STITCHKIT_EDITOR_DISCIPLINE = 'ui_ux'

export interface Membership {
  role: string
  disciplines: string[]
}

// The role an app gets for one account, across all its workspaces. The app sees it as the app_role claim.
export function appRoleFor(app: AppName, memberships: Membership[]): AppRole {
  const active = memberships.filter((item) => item.role !== 'viewer')
  if (app === 'dbdesign') {
    const allowed = active.some((item) => item.role === 'owner' || item.disciplines.some((d) => (DBDESIGN_DISCIPLINES as readonly string[]).includes(d)))
    return allowed ? 'editor' : 'none'
  }
  if (active.some((item) => item.disciplines.includes(STITCHKIT_EDITOR_DISCIPLINE))) return 'editor'
  return memberships.length > 0 ? 'viewer' : 'none'
}

// Whether a member of one workspace may use an app there. write is true for changes, false for reads.
export function workspaceAppAllowed(app: AppName, role: string | undefined, disciplines: string[], write: boolean): boolean {
  if (!role || role === 'viewer') return false
  if (app === 'dbdesign') return role === 'owner' || disciplines.some((d) => (DBDESIGN_DISCIPLINES as readonly string[]).includes(d))
  return !write || disciplines.includes(STITCHKIT_EDITOR_DISCIPLINE)
}

export async function appRolesOf(db: SQL, userId: string): Promise<Record<AppName, AppRole>> {
  const rows: Array<{ workspaceId: string; role: string; discipline: string | null }> = await db`
    SELECT m.workspace_id AS "workspaceId", m.role AS role, pm.discipline AS discipline
    FROM memberships m
    LEFT JOIN projects p ON p.workspace_id = m.workspace_id
    LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = m.user_id
    WHERE m.user_id = ${userId}`
  const byWorkspace = new Map<string, Membership>()
  for (const row of rows) {
    const entry = byWorkspace.get(row.workspaceId) ?? { role: row.role, disciplines: [] }
    if (row.discipline && !entry.disciplines.includes(row.discipline)) entry.disciplines.push(row.discipline)
    byWorkspace.set(row.workspaceId, entry)
  }
  const memberships = [...byWorkspace.values()]
  return { dbdesign: appRoleFor('dbdesign', memberships), stitchkit: appRoleFor('stitchkit', memberships) }
}

// Checks one workspace before the portal calls an app for it. Used by the web routes and by MCP.
export async function requireWorkspaceApp(db: SQL, userId: string, workspaceId: string, app: AppName, write: boolean): Promise<void> {
  const role = await findRole(db, workspaceId, userId)
  const disciplines = role ? await listUserDisciplines(db, workspaceId, userId) : []
  if (!workspaceAppAllowed(app, role, disciplines, write)) throw new AppError('APP_ACCESS_DENIED')
}

export async function workspaceAppAllowedFor(db: SQL, userId: string, workspaceId: string, app: AppName, write: boolean): Promise<boolean> {
  const role = await findRole(db, workspaceId, userId)
  const disciplines = role ? await listUserDisciplines(db, workspaceId, userId) : []
  return workspaceAppAllowed(app, role, disciplines, write)
}
