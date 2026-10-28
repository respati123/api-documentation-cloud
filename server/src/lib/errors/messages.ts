import type { Locale } from '../locale'
import type { ErrorCode } from './codes'
import { en } from './messages/en'
import { id } from './messages/id'
import type { ErrorParams, MessageEntry } from './types'

export const messages: Record<Locale, Record<ErrorCode, MessageEntry>> = { en, id }

export function renderMessage(entry: MessageEntry, params: ErrorParams): string {
  return typeof entry === 'string' ? entry : entry(params)
}
