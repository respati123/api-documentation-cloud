import { describe, expect, test } from 'bun:test'
import type { AppContext } from '@/context'
import type { AppError } from '@/lib/errors/app-error'
import type { SyncSocketData } from '@/models/workspace'
import { handleSyncSocketUpgrade } from '@/routes/realtime-public'

const portal = 'https://docs.respati.web.id'
const ctx = { config: { publicWebUrl: portal }, syncSocketTickets: new Map() } as unknown as AppContext
const server = { upgrade: () => true } as unknown as Bun.Server<SyncSocketData>

// Opens the socket with a ticket that does not exist, so the only answer that can come back is about the origin or the ticket.
async function refusalFor(origin: string): Promise<string | undefined> {
  const request = new Request('http://api.test/api/sync/events?ticket=unknown', { headers: { Origin: origin } })
  try {
    await handleSyncSocketUpgrade(ctx, request, new URL(request.url), 'GET', '/api/sync/events', server)
    return undefined
  } catch (error) {
    return (error as AppError).code
  }
}

describe('sync socket upgrade origin', () => {
  test('the portal origin passes the origin check and is refused only for its ticket', async () => {
    expect(await refusalFor(portal)).toBe('WEBSOCKET_TICKET_INVALID')
  })

  test('an origin that is not allowed is refused before the ticket is read', async () => {
    expect(await refusalFor('https://evil.example')).toBe('WEBSOCKET_ORIGIN_NOT_ALLOWED')
  })
})
