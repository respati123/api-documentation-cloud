import { currentRequestId } from './request-context'

export interface ResponseMeta {
  nextCursor?: string | null
}

interface SuccessBody<T> {
  code: 'OK' | 'CREATED'
  requestId: string
  data: T
  meta?: ResponseMeta
}

export function ok<T>(data: T, meta?: ResponseMeta): Response {
  return success(200, 'OK', data, meta)
}

export function created<T>(data: T): Response {
  return success(201, 'CREATED', data)
}

export function noContent(): Response {
  return new Response(null, { status: 204 })
}

function success<T>(status: number, code: SuccessBody<T>['code'], data: T, meta?: ResponseMeta): Response {
  const body: SuccessBody<T> = { code, requestId: currentRequestId(), data, ...(meta ? { meta } : {}) }
  return Response.json(body, { status })
}
