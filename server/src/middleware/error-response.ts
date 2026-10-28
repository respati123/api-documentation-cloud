import { AppError } from '@/lib/errors/app-error'
import type { Locale } from '@/lib/locale'
import { serializeError, type Logger } from '@/lib/logger'

export interface ErrorContext {
  requestId: string
  locale: Locale
  logger?: Logger
}

export function errorResponse(error: unknown, context: ErrorContext): Response {
  const appError = error instanceof AppError ? error : new AppError('INTERNAL_ERROR', { cause: error })
  logError(error, appError, context)
  const body = {
    error: appError.localizedMessage(context.locale),
    code: appError.code,
    requestId: context.requestId,
    ...(appError.details === undefined ? {} : { details: appError.details }),
  }
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Content-Language': context.locale,
    Vary: 'Accept-Language',
  })
  return new Response(JSON.stringify(body), { status: appError.status, headers })
}

function logError(original: unknown, appError: AppError, context: ErrorContext) {
  const fields = { requestId: context.requestId, code: appError.code, locale: context.locale }
  if (appError.status < 500) {
    context.logger?.warn(appError.message, fields)
    return
  }
  const cause = original instanceof Error ? original : appError
  context.logger?.error('request failed', { ...fields, error: serializeError(cause) })
}
