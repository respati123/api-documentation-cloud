export const MASKED_VALUE = '••••••'

const SENSITIVE_NAME = /authorization|cookie|token|secret|password|api[-_]?key/i
const SENSITIVE_ASSIGNMENT = /((?:authorization|cookie|token|secret|password|api[-_]?key)[\w-]*["']?\s*[:=]\s*["']?)([^"'`;\r\n,&}]+)/gi

export function isSensitiveName(value: string): boolean {
  return SENSITIVE_NAME.test(value)
}

export function redactText(value: string): string {
  try {
    return JSON.stringify(redactValue(JSON.parse(value)), null, 2)
  } catch {
    return value.replace(SENSITIVE_ASSIGNMENT, `$1${MASKED_VALUE}`)
  }
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [key, isSensitiveName(key) ? MASKED_VALUE : redactValue(nested)]),
  )
}
