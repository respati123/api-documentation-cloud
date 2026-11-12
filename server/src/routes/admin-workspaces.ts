import type { AppContext } from '@/context'
import { ok } from '@/lib/http'
import { decodeCursor, readLimit } from '@/lib/pagination'
import type { AuthUser } from '@/models/workspace'
import { listWorkspacesForAdmin } from '@/services/admin-workspaces'

export async function handleAdminWorkspaceRoutes(ctx: AppContext, url: URL, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  if (method !== 'GET' || path !== '/api/admin/workspaces') return undefined
  const page = await listWorkspacesForAdmin(ctx.db, user.id, url.searchParams.get('q') ?? '', readLimit(url), decodeCursor(url.searchParams.get('cursor')))
  return ok({ workspaces: page.items }, { nextCursor: page.nextCursor })
}
