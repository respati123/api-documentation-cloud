import type { AppContext } from '@/context'
import type { AuthUser, WorkspaceChangeReason } from '@/models/workspace'

export function isAllowedSyncOrigin(origin: string | null): boolean {
  if (!origin || origin === 'null' || origin === 'file://') return true
  try {
    const hostname = new URL(origin).hostname
    return hostname === 'localhost' || hostname === '127.0.0.1'
  } catch { return false }
}

// Sends one event to every open socket of a current member of the workspace.
export async function sendToMembers(ctx: AppContext, workspaceId: string, event: string) {
  const members = await ctx.db`SELECT user_id AS "userId" FROM memberships WHERE workspace_id = ${workspaceId}`
  const memberIds = new Set(members.map((member: { userId: unknown }) => String(member.userId)))
  for (const socket of ctx.syncSockets) {
    if (!memberIds.has(socket.data.userId)) continue
    try { socket.send(event) }
    catch { ctx.syncSockets.delete(socket) }
  }
}

export async function broadcastWorkspaceUpdate(ctx: AppContext, workspaceId: string, headId: string, message: string, actor: AuthUser, commitCount: number) {
  await sendToMembers(ctx, workspaceId, JSON.stringify({
    type: 'workspace.updated',
    workspaceId,
    headCommitId: headId,
    message,
    actorId: actor.id,
    actorEmail: actor.email,
    commitCount
  }))
}

// Tells open pages that something changed, so they reload that part. The reason says which part.
export async function broadcastWorkspaceChange(ctx: AppContext, workspaceId: string, reason: WorkspaceChangeReason) {
  await sendToMembers(ctx, workspaceId, JSON.stringify({ type: 'workspace.changed', workspaceId, reason }))
}
