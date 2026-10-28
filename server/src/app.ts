import type { AppContext } from '@/context'
import { AppError } from '@/lib/errors/app-error'
import { negotiateLocale } from '@/lib/locale'
import { routeLabel } from '@/lib/route-label'
import { runWithRequestId } from '@/lib/request-context'
import type { SyncSocketData } from '@/models/workspace'
import { errorResponse } from '@/middleware/error-response'
import { resolveRequestId } from '@/middleware/request-id'
import { isSensitivePath, withResponseHeaders } from '@/middleware/response-headers'
import { routeRequest } from '@/router'
import { isRecord } from '@/lib/validation'

// Builds the Bun server handlers: the websocket callbacks and the fetch wrapper that logs each request.
export function createApp(ctx: AppContext) {
  const { logger, config, syncSockets } = ctx

  function logRequest({ method, path, status, durationMs, requestId }: { method: string; path: string; status: number; durationMs: number; requestId: string }) {
    const fields = { method, route: routeLabel(path), status, durationMs: Math.round(durationMs), requestId }
    if (status >= 500) logger.error('request', fields)
    else if (status >= 400) logger.warn('request', fields)
    else logger.info('request', fields)
  }

  return {
    websocket: {
      data: {} as SyncSocketData,
      open(socket: Bun.ServerWebSocket<SyncSocketData>) { syncSockets.add(socket) },
      message(socket: Bun.ServerWebSocket<SyncSocketData>) { socket.close(1008, 'Client messages are not supported.') },
      close(socket: Bun.ServerWebSocket<SyncSocketData>) { syncSockets.delete(socket) }
    },
    async fetch(request: Request, server?: Bun.Server<SyncSocketData>): Promise<Response | undefined> {
      const started = performance.now()
      const requestId = resolveRequestId(request.headers.get('X-Request-Id'))
      const locale = negotiateLocale(request.headers.get('Accept-Language'))
      const origin = request.headers.get('Origin')
      const path = new URL(request.url).pathname
      let response: Response | undefined
      try {
        response = await runWithRequestId(requestId, () => routeRequest(ctx, request, server))
      } catch (error) {
        const duplicate = isRecord(error) && error.code === '23505'
        response = errorResponse(duplicate ? new AppError('ALREADY_MEMBER') : error, { requestId, locale, logger })
      }
      if (!response) return undefined
      logRequest({ method: request.method, path, status: response.status, durationMs: performance.now() - started, requestId })
      return withResponseHeaders(response, { requestId, origin, allowedOrigins: config.corsOrigins, sensitive: isSensitivePath(path) })
    }
  }
}
