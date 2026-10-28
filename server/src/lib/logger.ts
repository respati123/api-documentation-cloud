export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LoggerOptions {
  level: LogLevel
  service: string
  version: string
  sink?: (line: string) => void
}

export interface Logger {
  debug: (msg: string, fields?: Record<string, unknown>) => void
  info: (msg: string, fields?: Record<string, unknown>) => void
  warn: (msg: string, fields?: Record<string, unknown>) => void
  error: (msg: string, fields?: Record<string, unknown>) => void
}

export interface SerializedError {
  name: string
  message: string
  code?: string
  stack?: string
  cause?: SerializedError
}

const levelRank: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 }
const redactedKeys = new Set(['password', 'passwordhash', 'token', 'authorization', 'secret', 'cookie', 'databaseurl'])
const maxCauseDepth = 5

export function createLogger(options: LoggerOptions): Logger {
  const sink = options.sink ?? ((line: string) => process.stdout.write(`${line}\n`))
  const write = (level: LogLevel, msg: string, fields: Record<string, unknown> = {}) => {
    if (levelRank[level] < levelRank[options.level]) return
    const line = { time: new Date().toISOString(), level, service: options.service, version: options.version, msg, ...redact(fields) }
    sink(JSON.stringify(line))
  }
  return {
    debug: (msg, fields) => write('debug', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    error: (msg, fields) => write('error', msg, fields),
  }
}

export function serializeError(error: Error, depth = 0): SerializedError {
  const code = (error as { code?: unknown }).code
  const serialized: SerializedError = {
    name: error.name,
    message: error.message,
    ...(typeof code === 'string' ? { code } : {}),
    ...(error.stack ? { stack: error.stack } : {}),
  }
  if (error.cause instanceof Error && depth < maxCauseDepth) serialized.cause = serializeError(error.cause, depth + 1)
  return serialized
}

function redact(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, redactValue(key, entry)]))
}

function redactValue(key: string, value: unknown): unknown {
  if (redactedKeys.has(key.toLowerCase())) return '[REDACTED]'
  if (value instanceof Error) return serializeError(value)
  if (Array.isArray(value)) return value.map((item) => redactValue('', item))
  if (value && typeof value === 'object') return redact(value as Record<string, unknown>)
  return value
}
