import i18next from '@/shared/i18n'

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

// The absolute address of an API path, for text the user copies into another tool.
export function absoluteApiUrl(path: string): string {
  return `${apiBaseUrl || window.location.origin}${path}`
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly requestId: string | undefined
  readonly details: unknown

  constructor(message: string, status: number, body: { code?: string; requestId?: string; details?: unknown } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code
    this.requestId = body.requestId
    this.details = body.details
  }
}

interface ApiCallOptions {
  token?: string
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

export interface ApiPage<T> {
  data: T
  nextCursor: string | null
  total?: number
}

// Callers that use a schema should pass the result through zod before using it.
// Legacy callers still rely on the generic parameter until they are migrated.
export async function apiCall<T = unknown>(path: string, options: ApiCallOptions = {}): Promise<T> {
  return unwrapData<T>(await send(path, options))
}

export async function apiBlob(path: string, token?: string): Promise<Blob> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  if (!response.ok) throw new ApiError(`Download failed (${response.status}).`, response.status)
  return response.blob()
}

// For list endpoints. The response meta carries the cursor for the next page, or null on the last page.
export async function apiPage<T = unknown>(path: string, options: ApiCallOptions = {}): Promise<ApiPage<T>> {
  const result = await send(path, options)
  const total = readTotal(result)
  return { data: unwrapData<T>(result), nextCursor: readNextCursor(result), ...(total === null ? {} : { total }) }
}

async function send(path: string, options: ApiCallOptions): Promise<unknown> {
  const form = options.body instanceof FormData
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    // The session lives in an HttpOnly cookie, so the browser must send it with every request.
    credentials: 'include',
    headers: {
      ...(options.body === undefined || form ? {} : { 'Content-Type': 'application/json' }),
      'Accept-Language': i18next.resolvedLanguage ?? i18next.language,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: form ? (options.body as FormData) : JSON.stringify(options.body) }),
  })
  const result: unknown = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new ApiError(readErrorMessage(result) ?? `Request failed (${response.status}).`, response.status, readErrorBody(result))
  return result
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${apiBaseUrl}/health`, { cache: 'no-store' })
    return response.ok
  } catch {
    return false
  }
}

function readErrorMessage(value: unknown): string | undefined {
  if (typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string') return value.error
  return undefined
}

function readErrorBody(value: unknown): { code?: string; requestId?: string; details?: unknown } {
  if (typeof value !== 'object' || value === null) return {}
  const { code, requestId, details } = value as { code?: unknown; requestId?: unknown; details?: unknown }
  return {
    code: typeof code === 'string' ? code : undefined,
    requestId: typeof requestId === 'string' ? requestId : undefined,
    details,
  }
}

function unwrapData<T>(value: unknown): T {
  if (typeof value === 'object' && value !== null && 'data' in value) return value.data as T
  return value as T
}

function readNextCursor(value: unknown): string | null {
  if (typeof value !== 'object' || value === null || !('meta' in value)) return null
  const meta = value.meta
  if (typeof meta !== 'object' || meta === null || !('nextCursor' in meta)) return null
  return typeof meta.nextCursor === 'string' ? meta.nextCursor : null
}

function readTotal(value: unknown): number | null {
  if (typeof value !== 'object' || value === null || !('meta' in value)) return null
  const meta = value.meta
  if (typeof meta !== 'object' || meta === null || !('total' in meta)) return null
  return typeof meta.total === 'number' && Number.isInteger(meta.total) && meta.total >= 0 ? meta.total : null
}
