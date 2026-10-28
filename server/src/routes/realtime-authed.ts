import type { AppContext } from '@/context'
import type { AuthUser } from '@/models/workspace'
import { created } from '@/lib/http'
import { randomBytes } from 'node:crypto'
import { tokenHash } from '@/services/auth'


export async function handleSyncTicket(ctx: AppContext, method: string, path: string, user: AuthUser): Promise<Response | undefined> {
  const { syncSocketTickets } = ctx
  if (method === 'POST' && path === '/api/sync/events-ticket') {
    const now = Date.now()
    for (const [key, value] of syncSocketTickets) if (value.expiresAt <= now) syncSocketTickets.delete(key)
    const ticket = randomBytes(32).toString('base64url')
    syncSocketTickets.set(tokenHash(ticket), { userId: user.id, expiresAt: now + 30_000 })
    return created({ ticket, expiresInSeconds: 30 })
  }
  return undefined
}
