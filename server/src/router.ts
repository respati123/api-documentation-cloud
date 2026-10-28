import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { ok } from '@/lib/http'
import type { SyncSocketData } from '@/models/workspace'
import { preflightResponse } from '@/middleware/cors'
import { currentUser } from '@/services/auth'
import { handleDesktopApprove } from '@/routes/desktop'
import { handleInviteAccept } from '@/routes/invite-accept'
import { handleMembers } from '@/routes/members'
import { handlePublicRoutes } from '@/routes/public'
import { handleSyncSocketUpgrade } from '@/routes/realtime-public'
import { handleSyncTicket } from '@/routes/realtime-authed'
import { handleSync } from '@/routes/sync'
import { handleWorkspaceCollection } from '@/routes/workspace-collection'
import { handleWorkspaceRecord } from '@/routes/workspace-record'

// Order matters. Public routes come first, then the socket upgrade, then routes that need a signed-in user.
// A route module returns undefined when the method and path do not match, so the next module gets a turn.
export async function routeRequest(ctx: AppContext, request: Request, server?: Bun.Server<SyncSocketData>): Promise<Response | undefined> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = request.method.toUpperCase()
  if (method === 'GET' && path === '/health') return ok({ ok: true })

  // A browser sends the preflight without credentials, so it is answered before any session check.
  if (method === 'OPTIONS') return preflightResponse(request.headers.get('Origin'), ctx.config.corsOrigins)

  if (method === 'GET' && path === '/api/sync/events') {
    if (!server) throw new AppError('WEBSOCKET_UNAVAILABLE')
    return handleSyncSocketUpgrade(ctx, request, url, method, path, server)
  }

  const publicResponse = await handlePublicRoutes(ctx, request, method, path)
  if (publicResponse) return publicResponse

  const user = await currentUser(ctx.db, request)
  const ticketResponse = await handleSyncTicket(ctx, method, path, user)
  if (ticketResponse) return ticketResponse
  const desktopResponse = await handleDesktopApprove(ctx, method, path, user)
  if (desktopResponse) return desktopResponse
  const collectionResponse = await handleWorkspaceCollection(ctx, request, url, method, path, user)
  if (collectionResponse) return collectionResponse
  const inviteResponse = await handleInviteAccept(ctx, request, method, path, user)
  if (inviteResponse) return inviteResponse

  const workspaceMatch = path.match(/^\/api\/workspaces\/([\w-]+)(?:\/(.*))?$/)
  if (!workspaceMatch) throw new AppError('ROUTE_NOT_FOUND')
  const workspaceId = workspaceMatch[1]
  const action = workspaceMatch[2] || ''

  const recordResponse = await handleWorkspaceRecord(ctx, request, method, workspaceId, action, user)
  if (recordResponse) return recordResponse
  const membersResponse = await handleMembers(ctx, request, url, method, workspaceId, action, user)
  if (membersResponse) return membersResponse
  const syncResponse = await handleSync(ctx, request, url, method, workspaceId, action, user)
  if (syncResponse) return syncResponse

  throw new AppError('ROUTE_NOT_FOUND')
}
