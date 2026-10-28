export const MASKED_VALUE = '••••••'

const SENSITIVE_NAME = /authorization|cookie|token|secret|password|api[-_]?key/i
const SENSITIVE_ASSIGNMENT = /((?:authorization|cookie|token|secret|password|api[-_]?key)["']?\s*[:=]\s*["']?)([^"'\s,}]+)/gi

export function isSensitiveName(value: string): boolean {
  return SENSITIVE_NAME.test(value)
}

export function redactText(value: string): string {
  try {
    const parsed: unknown = JSON.parse(value)
    return JSON.stringify(redactValue(parsed), null, 2)
  } catch {
    return value.replace(SENSITIVE_ASSIGNMENT, `$1${MASKED_VALUE}`)
  }
}

function redactValue(entry: unknown): unknown {
  if (Array.isArray(entry)) return entry.map(redactValue)
  if (!entry || typeof entry !== 'object') return entry
  return Object.fromEntries(Object.entries(entry).map(([key, nested]) => [key, isSensitiveName(key) ? MASKED_VALUE : redactValue(nested)]))
}
