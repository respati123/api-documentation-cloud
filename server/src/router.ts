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
import { handleBranches } from '@/routes/branches'
import { handleWorkspaceVariables } from '@/routes/workspace-variables'
import { handleSessions } from '@/routes/sessions'
import { refusesCookieWrite, trustedOrigins } from '@/services/auth'
import { handleSync } from '@/routes/sync'
import { handleWorkspaceCollection } from '@/routes/workspace-collection'
import { handleWorkspaceRecord } from '@/routes/workspace-record'
import { handleProjectRoutes } from '@/routes/projects'
import { handleMcpRequest } from '@/routes/mcp'
import { broadcastPlanningChange, planningScopeOf } from '@/services/events'
import { audienceFromAction, planningAudience } from '@/services/planning-audience'
import { handleAdminWorkspaceRoutes } from '@/routes/admin-workspaces'
import { handleMcpKeyRoutes } from '@/routes/mcp-keys'
import { handleNotificationRoutes } from '@/routes/notifications'
import { handlePlanningRoutes } from '@/routes/planning'

// Order matters. Public routes come first, then the socket upgrade, then routes that need a signed-in user.
// A route module returns undefined when the method and path do not match, so the next module gets a turn.
export async function routeRequest(ctx: AppContext, request: Request, server?: Bun.Server<SyncSocketData>): Promise<Response | undefined> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = request.method.toUpperCase()
  if (method === 'GET' && path === '/health') return ok({ ok: true })

  // A browser sends the preflight without credentials, so it is answered before any session check.
  if (method === 'OPTIONS') return preflightResponse(request.headers.get('Origin'), ctx.config.corsOrigins)

  // A write that carries only the session cookie must come from a trusted origin.
  if (refusesCookieWrite(request, trustedOrigins(ctx.config.corsOrigins, ctx.config.publicWebUrl))) throw new AppError('CSRF_ORIGIN_REFUSED')

  if (method === 'GET' && path === '/api/sync/events') {
    if (!server) throw new AppError('WEBSOCKET_UNAVAILABLE')
    return handleSyncSocketUpgrade(ctx, request, url, method, path, server)
  }

  if (path === '/api/mcp') return handleMcpRequest(ctx, request, method)

  const publicResponse = await handlePublicRoutes(ctx, request, method, path)
  if (publicResponse) return publicResponse

  const sessionsResponse = await handleSessions(ctx, request, method, path)
  if (sessionsResponse) return sessionsResponse

  const user = await currentUser(ctx.db, request)
  const mcpKeyResponse = await handleMcpKeyRoutes(ctx, request, url, method, path, user)
  if (mcpKeyResponse) return mcpKeyResponse
  const adminWorkspaceResponse = await handleAdminWorkspaceRoutes(ctx, url, method, path, user)
  if (adminWorkspaceResponse) return adminWorkspaceResponse
  const notificationResponse = await handleNotificationRoutes(ctx, url, method, path, user)
  if (notificationResponse) return notificationResponse
  const ticketResponse = await handleSyncTicket(ctx, method, path, user)
  if (ticketResponse) return ticketResponse
  const desktopResponse = await handleDesktopApprove(ctx, request, method, path, user)
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
  const projectResponse = await handleProjectRoutes(ctx, request, method, workspaceId, action, user)
  if (projectResponse) return announcePlanningWrite(ctx, method, workspaceId, action, user.id, projectResponse)
  const planningResponse = await handlePlanningRoutes(ctx, request, method, workspaceId, action, user)
  if (planningResponse) return announcePlanningWrite(ctx, method, workspaceId, action, user.id, planningResponse)
  const syncResponse = await handleSync(ctx, request, url, method, workspaceId, action, user)
  if (syncResponse) return syncResponse
  const branchResponse = await handleBranches(ctx, request, url, method, workspaceId, action, user)
  if (branchResponse) return branchResponse
  const variablesResponse = await handleWorkspaceVariables(ctx, request, method, workspaceId, action, user)
  if (variablesResponse) return variablesResponse

  throw new AppError('ROUTE_NOT_FOUND')
}

// A successful write to project data is announced to the workspace's open pages, so they refresh without polling.
async function announcePlanningWrite(ctx: AppContext, method: string, workspaceId: string, action: string, actorId: string, response: Response): Promise<Response> {
  const scope = planningScopeOf(action)
  const target = audienceFromAction(action)
  if (method !== 'GET' && response.ok && scope && target) broadcastPlanningChange(ctx, workspaceId, scope, actorId, await planningAudience(ctx.db, workspaceId, target))
  return response
}
