import { ApiError } from '@/shared/services/api-client'

// Backend messages are shown unchanged. Any other failure falls back to the given text.
export function readErrorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback
}
