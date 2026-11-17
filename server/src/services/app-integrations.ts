import { randomUUID } from 'node:crypto'
import type { SQL } from 'bun'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { deleteAppLink, insertAppLink, listAppLinks, type AppName } from '@/repositories/app-links.repository'
import { findRole } from '@/repositories/memberships.repository'
import { findUserById, isAdminUser } from '@/repositories/users.repository'
import type { OidcUser } from '@/services/oidc-keys'

export const APPS: readonly AppName[] = ['dbdesign', 'stitchkit']

export function appNameOf(value: unknown): AppName {
  if (typeof value !== 'string' || !(APPS as readonly string[]).includes(value)) throw new AppError('APP_NAME_INVALID')
  return value as AppName
}

// The member as the apps see them: the portal user id, email, and app admin flag, signed into each service token.
export async function appActorOf(db: SQL, userId: string): Promise<OidcUser> {
  const user = await findUserById(db, userId)
  if (!user) throw new AppError('ACCOUNT_NOT_FOUND')
  return { id: user.id, email: user.email, isAdmin: await isAdminUser(db, user.id) }
}

async function requireMember(db: SQL, workspaceId: string, userId: string) {
  const role = await findRole(db, workspaceId, userId)
  if (!role) throw new AppError('WORKSPACE_NOT_FOUND')
  return role
}

// Linking and unlinking change what the whole workspace sees, so only the owner does it.
async function requireOwner(db: SQL, workspaceId: string, userId: string) {
  if ((await requireMember(db, workspaceId, userId)) !== 'owner') throw new AppError('ROLE_NOT_ALLOWED')
}

// Both apps for the Design pages: whether each is set up, where it lives, and the projects linked to this workspace.
export async function listWorkspaceApps(ctx: AppContext, workspaceId: string, userId: string) {
  const role = await requireMember(ctx.db, workspaceId, userId)
  const links = await listAppLinks(ctx.db, workspaceId)
  return {
    canManage: role === 'owner',
    apps: APPS.map((app) => ({
      app,
      enabled: ctx.apps.enabled(app),
      baseUrl: ctx.config.apps[app],
      links: links
        .filter((link) => link.app === app)
        .map((link) => ({ id: link.id, projectId: link.appProjectId, name: link.appProjectName, url: ctx.apps.openUrl(app, link.appProjectId), linkedAt: link.createdAt })),
    })),
  }
}

// Projects the owner can open in the app and has not linked yet.
export async function listAvailableAppProjects(ctx: AppContext, workspaceId: string, userId: string, app: AppName) {
  await requireOwner(ctx.db, workspaceId, userId)
  const linked = new Set((await listAppLinks(ctx.db, workspaceId, app)).map((link) => link.appProjectId))
  const projects = await ctx.apps.listProjects(app, await appActorOf(ctx.db, userId))
  return projects.filter((project) => !linked.has(project.id))
}

// The owner may link only a project their own app account can open, so a link never points at something hidden.
export async function linkAppProject(ctx: AppContext, workspaceId: string, userId: string, app: AppName, input: Record<string, unknown>) {
  await requireOwner(ctx.db, workspaceId, userId)
  const appProjectId = typeof input.appProjectId === 'string' ? input.appProjectId.trim() : ''
  if (!appProjectId || appProjectId.length > 100) throw new AppError('APP_PROJECT_NOT_FOUND')
  const project = (await ctx.apps.listProjects(app, await appActorOf(ctx.db, userId))).find((item) => item.id === appProjectId)
  if (!project) throw new AppError('APP_PROJECT_NOT_FOUND')
  const id = randomUUID()
  const added = await insertAppLink(ctx.db, { id, workspaceId, app, appProjectId, appProjectName: project.name.slice(0, 200) || appProjectId, createdBy: userId })
  if (!added) throw new AppError('PLANNING_CONFLICT')
  return { id, app, projectId: appProjectId, name: project.name, url: ctx.apps.openUrl(app, appProjectId) }
}

export async function unlinkAppProject(ctx: AppContext, workspaceId: string, userId: string, linkId: string) {
  await requireOwner(ctx.db, workspaceId, userId)
  if (!(await deleteAppLink(ctx.db, workspaceId, linkId))) throw new AppError('APP_LINK_NOT_FOUND')
}

// A project the member cannot open in the app shows with its error code instead of hiding every other project.
async function perLinkedProject<T>(ctx: AppContext, workspaceId: string, userId: string, app: AppName, read: (actor: OidcUser, projectId: string) => Promise<T[]>) {
  await requireMember(ctx.db, workspaceId, userId)
  const links = await listAppLinks(ctx.db, workspaceId, app)
  if (links.length === 0) return []
  const actor = await appActorOf(ctx.db, userId)
  return Promise.all(
    links.map(async (link) => {
      try {
        return { projectId: link.appProjectId, projectName: link.appProjectName, items: await read(actor, link.appProjectId), error: null as string | null }
      } catch (error) {
        if (!(error instanceof AppError)) throw error
        return { projectId: link.appProjectId, projectName: link.appProjectName, items: [] as T[], error: error.code as string }
      }
    }),
  )
}

// Screens of the Stitchkit projects linked to the workspace, for the story design picker.
export function listLinkedStitchkitScreens(ctx: AppContext, workspaceId: string, userId: string) {
  return perLinkedProject(ctx, workspaceId, userId, 'stitchkit', async (actor, projectId) =>
    (await ctx.apps.stitchkitScreens(actor, projectId)).map((screen) => ({ ...screen, url: ctx.apps.openUrl('stitchkit', projectId, screen.id) })),
  )
}

// Tables of the DBDesign projects linked to the workspace, for the story data model picker.
export function listLinkedDbdesignTables(ctx: AppContext, workspaceId: string, userId: string) {
  return perLinkedProject(ctx, workspaceId, userId, 'dbdesign', async (actor, projectId) => (await ctx.apps.dbdesignTables(actor, projectId)).tables)
}
