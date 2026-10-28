import type { SyncSocketData } from '@/models/workspace'
import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { isAllowedSyncOrigin } from '@/services/events'
import { tokenHash } from '@/services/auth'


export async function handleSyncSocketUpgrade(ctx: AppContext, request: Request, url: URL, method: string, path: string, server: Bun.Server<SyncSocketData>): Promise<Response | undefined> {
  const { syncSocketTickets } = ctx
  if (method === 'GET' && path === '/api/sync/events') {
    if (!isAllowedSyncOrigin(request.headers.get('origin'))) throw new AppError('WEBSOCKET_ORIGIN_NOT_ALLOWED')
    const ticket = url.searchParams.get('ticket')
    const ticketKey = ticket ? tokenHash(ticket) : ''
    const ticketData = ticketKey ? syncSocketTickets.get(ticketKey) : undefined
    if (!ticketData || ticketData.expiresAt <= Date.now()) {
      if (ticketKey) syncSocketTickets.delete(ticketKey)
      throw new AppError('WEBSOCKET_TICKET_INVALID')
    }
    syncSocketTickets.delete(ticketKey)
    if (!server.upgrade(request, { data: { userId: ticketData.userId } })) throw new AppError('WEBSOCKET_UNAVAILABLE')
    return undefined
  }
  return undefined
}
