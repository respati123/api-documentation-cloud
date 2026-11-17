import type { AppContext } from '@/context'
import type { AuthUser, WorkspaceChangeReason } from '@/models/workspace'
import { listMemberIds } from '@/repositories/memberships.repository'
import { type ChangeSummary, maxChangeSummary } from '@/services/change-summary'

// The portal's own origin is compared as a whole (scheme, host, port), so a look-alike host is refused.
export function isAllowedSyncOrigin(origin: string | null, publicWebUrl: string): boolean {
  if (!origin || origin === 'null' || origin === 'file://') return true
  try {
    if (origin === new URL(publicWebUrl).origin) return true
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch { return false }
}

// Sends one event to every open socket of a current member of the workspace.
export async function sendToMembers(ctx: AppContext, workspaceId: string, event: string) {
  const memberIds = new Set(await listMemberIds(ctx.db, workspaceId))
  for (const socket of ctx.syncSockets) {
    if (!memberIds.has(socket.data.userId)) continue
    try { socket.send(event) }
    catch { ctx.syncSockets.delete(socket) }
  }
}

// Sends one event to every open socket of one account, such as a new notification for that person.
export function sendToUser(ctx: AppContext, userId: string, event: string) {
  for (const socket of ctx.syncSockets) {
    if (socket.data.userId !== userId) continue
    try { socket.send(event) }
    catch { ctx.syncSockets.delete(socket) }
  }
}

export type PlanningScope = 'documents' | 'items' | 'comments' | 'tasks' | 'members'

// Which part of a project a write touched, read from the route after /api/workspaces/{id}/. Null for anything else.
export function planningScopeOf(action: string): PlanningScope | null {
  if (/^planning\/(document|epic|story|task)\/[\w-]+\/comments$/.test(action) || /^planning\/comments\//.test(action)) return 'comments'
  if (action.startsWith('planning/documents')) return 'documents'
  if (action.startsWith('planning/')) return 'items'
  if (/^projects\/[\w-]+(\/(issues|sprints|backlog|wip-limits)(\/.*)?|\/documents\/[\w-]+\/draft-backlog)?$/.test(action)) return 'items'
  if (/^tasks\//.test(action) || /^projects\/[\w-]+\/tasks$/.test(action)) return 'tasks'
  if (/^projects\/[\w-]+\/members$/.test(action)) return 'members'
  return null
}

// Tells the open pages of people who may read the change that project data changed, so they reload that part.
// The audience comes from planningAudience; everyone else in the workspace hears nothing. Agents and people both trigger it.
export function broadcastPlanningChange(ctx: AppContext, workspaceId: string, scope: PlanningScope, actorId: string, audience: string[]) {
  const readers = new Set(audience)
  const event = JSON.stringify({ type: 'planning.changed', workspaceId, scope, actorId })
  for (const socket of ctx.syncSockets) {
    if (!readers.has(socket.data.userId)) continue
    try { socket.send(event) }
    catch { ctx.syncSockets.delete(socket) }
  }
}

// changes lists the items the push changed, at most maxChangeSummary of them. changeTotal counts all of them.
// Both are optional for readers: an older app ignores them.
export async function broadcastWorkspaceUpdate(ctx: AppContext, workspaceId: string, headId: string, message: string, actor: AuthUser, commitCount: number, changes: ChangeSummary[] = []) {
  await sendToMembers(ctx, workspaceId, JSON.stringify({
    type: 'workspace.updated',
    workspaceId,
    headCommitId: headId,
    message,
    actorId: actor.id,
    actorEmail: actor.email,
    commitCount,
    changes: changes.slice(0, maxChangeSummary),
    changeTotal: changes.length,
  }))
}

// Tells open pages that something changed, so they reload that part. The reason says which part.
export async function broadcastWorkspaceChange(ctx: AppContext, workspaceId: string, reason: WorkspaceChangeReason) {
  await sendToMembers(ctx, workspaceId, JSON.stringify({ type: 'workspace.changed', workspaceId, reason }))
}
