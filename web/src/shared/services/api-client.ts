import i18next from '@/shared/i18n'

const apiBaseUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

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
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
}

// Callers that use a schema should pass the result through zod before using it.
// Legacy callers still rely on the generic parameter until they are migrated.
export async function apiCall<T = unknown>(path: string, options: ApiCallOptions = {}): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      'Accept-Language': i18next.resolvedLanguage ?? i18next.language,
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
  })
  const result: unknown = await response.json().catch(() => ({}))
  if (!response.ok)
    throw new ApiError(readErrorMessage(result) ?? `Request failed (${response.status}).`, response.status, readErrorBody(result))
  return result as T
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
