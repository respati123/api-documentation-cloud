import type { AppContext } from '@/context'
import { bodyOf } from '@/lib/http-body'
import { created, noContent, ok } from '@/lib/http'
import type { AuthUser } from '@/models/workspace'
import {
  appNameOf,
  linkAppProject,
  listAvailableAppProjects,
  listLinkedDbdesignTables,
  listLinkedStitchkitScreens,
  listWorkspaceApps,
  unlinkAppProject,
} from '@/services/app-integrations'

// Workspace routes for DBDesign and Stitchkit: the Design pages, linking, and the pickers used on stories.
export async function handleAppRoutes(ctx: AppContext, request: Request, method: string, workspaceId: string, action: string, user: AuthUser): Promise<Response | undefined> {
  if (action === 'apps' && method === 'GET') return ok(await listWorkspaceApps(ctx, workspaceId, user.id))
  if (action === 'apps/stitchkit/screens' && method === 'GET') return ok({ projects: await listLinkedStitchkitScreens(ctx, workspaceId, user.id) })
  if (action === 'apps/dbdesign/tables' && method === 'GET') return ok({ projects: await listLinkedDbdesignTables(ctx, workspaceId, user.id) })
  const availableMatch = action.match(/^apps\/([\w-]+)\/available$/)
  if (availableMatch && method === 'GET') return ok({ projects: await listAvailableAppProjects(ctx, workspaceId, user.id, appNameOf(availableMatch[1])) })
  const linksMatch = action.match(/^apps\/([\w-]+)\/links$/)
  if (linksMatch && method === 'POST') return created({ link: await linkAppProject(ctx, workspaceId, user.id, appNameOf(linksMatch[1]), await bodyOf(request)) })
  const unlinkMatch = action.match(/^apps\/links\/([\w-]+)$/)
  if (unlinkMatch && method === 'DELETE') {
    await unlinkAppProject(ctx, workspaceId, user.id, unlinkMatch[1])
    return noContent()
  }
  return undefined
}
