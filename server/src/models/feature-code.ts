const PREFIX_PATTERN = /^[A-Z]{2,8}$/
const CODE_PATTERN = /^([A-Z]{2,8})-(\d{3,})$/

// The prefix of a feature code is the product area the PM picks: 2 to 8 capital letters, such as AUTH or BUDG.
export function isFeaturePrefix(value: unknown): value is string {
  return typeof value === 'string' && PREFIX_PATTERN.test(value)
}

// A new epic without a chosen prefix takes the project key, cut to eight letters. Migration 0030 does the same in SQL.
export function defaultFeaturePrefix(projectKey: string): string {
  return projectKey.slice(0, 8)
}

// The code people read and search for: the prefix, a dash, and the number with at least three digits, such as AUTH-001.
export function formatFeatureCode(prefix: string, number: number): string {
  return `${prefix}-${String(number).padStart(3, '0')}`
}

export function parseFeatureCode(value: string): { prefix: string; number: number } | null {
  const match = CODE_PATTERN.exec(value.trim().toUpperCase())
  if (!match) return null
  const number = Number(match[2])
  return number >= 1 ? { prefix: match[1], number } : null
}
