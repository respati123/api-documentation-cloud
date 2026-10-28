import * as z from 'zod/mini'

const workspaceUpdatedSchema = z.object({
  type: z.literal('workspace.updated'),
  workspaceId: z.string(),
  headCommitId: z.string(),
  message: z.string(),
  actorId: z.string(),
  actorEmail: z.string(),
  commitCount: z.number(),
})

const workspaceChangedSchema = z.object({
  type: z.literal('workspace.changed'),
  workspaceId: z.string(),
  reason: z.enum(['members', 'invites', 'settings', 'deleted']),
})

const syncEventSchema = z.union([workspaceUpdatedSchema, workspaceChangedSchema])

export type WorkspaceUpdatedEvent = z.infer<typeof workspaceUpdatedSchema>
export type WorkspaceChangedEvent = z.infer<typeof workspaceChangedSchema>
export type SyncEvent = WorkspaceUpdatedEvent | WorkspaceChangedEvent

// Returns the event when the data is a known workspace event, and null for anything else.
export function parseSyncEvent(raw: string): SyncEvent | null {
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return null
  }
  const result = z.safeParse(syncEventSchema, value)
  return result.success ? result.data : null
}

// Doubles from one second and stops at thirty seconds.
export function reconnectDelay(attempt: number): number {
  return Math.min(1000 * 2 ** attempt, 30_000)
}

// The API base comes from VITE_API_URL. When it is empty, the page origin is used, and nginx forwards /api.
export function socketUrl(apiBase: string, location: { protocol: string; host: string }, ticket: string): string {
  const base = apiBase ? new URL(apiBase) : null
  const protocol = base ? base.protocol : location.protocol
  const host = base ? base.host : location.host
  const scheme = protocol === 'https:' ? 'wss' : 'ws'
  return `${scheme}://${host}/api/sync/events?ticket=${encodeURIComponent(ticket)}`
}
