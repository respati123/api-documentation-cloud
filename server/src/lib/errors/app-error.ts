import type { Locale } from '../locale'
import { errorDefinitions, type ErrorCode } from './codes'
import { messages, renderMessage } from './messages'
import type { ErrorParams } from './types'

export interface AppErrorOptions {
  params?: ErrorParams
  details?: unknown
  cause?: unknown
}

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly params: ErrorParams
  readonly details: unknown

  constructor(code: ErrorCode, options: AppErrorOptions = {}) {
    const params = options.params ?? {}
    super(renderMessage(messages.en[code], params), { cause: options.cause })
    this.name = 'AppError'
    this.code = code
    this.status = errorDefinitions[code].status
    this.params = params
    this.details = options.details
  }

  localizedMessage(locale: Locale): string {
    return renderMessage(messages[locale][this.code], this.params)
  }
}
