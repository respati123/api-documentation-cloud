import { ApiError } from '@/shared/services/api-client'

export function shouldEndSession(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401
}
