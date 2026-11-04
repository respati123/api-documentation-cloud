import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { noContent, ok } from '@/lib/http'
import { clearedSessionCookie, currentSession, isSecureOrigin } from '@/services/auth'
import { listLiveSessions, deleteSessionById } from '@/repositories/sessions.repository'

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// The signed-in user's own sessions: the web browsers and the desktop app they signed in with.
export async function handleSessions(ctx: AppContext, request: Request, method: string, path: string): Promise<Response | undefined> {
  if (method === 'GET' && path === '/api/me/sessions') {
    const current = await currentSession(ctx.db, request)
    const sessions = await listLiveSessions(ctx.db, current.user.id)
    return ok({
      sessions: sessions.map((item) => ({
        id: item.id,
        client: item.client,
        device: item.device,
        createdAt: item.createdAt.toISOString(),
        lastUsedAt: item.lastUsedAt.toISOString(),
        current: item.id === current.sessionId,
      })),
    })
  }

  const match = path.match(/^\/api\/me\/sessions\/([^/]+)$/)
  if (method === 'DELETE' && match) {
    const current = await currentSession(ctx.db, request)
    const sessionId = match[1]
    if (!uuidPattern.test(sessionId)) throw new AppError('SESSION_NOT_FOUND')
    if (!(await deleteSessionById(ctx.db, current.user.id, sessionId))) throw new AppError('SESSION_NOT_FOUND')
    const response = noContent()
    if (sessionId === current.sessionId) response.headers.append('Set-Cookie', clearedSessionCookie(isSecureOrigin(ctx.config.publicWebUrl)))
    return response
  }
  return undefined
}
