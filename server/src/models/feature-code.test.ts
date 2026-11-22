import { describe, expect, test } from 'bun:test'
import { defaultFeaturePrefix, formatFeatureCode, isFeaturePrefix, parseFeatureCode } from '@/models/feature-code'

describe('isFeaturePrefix', () => {
  test('a prefix is 2 to 8 capital letters', () => {
    for (const prefix of ['AU', 'AUTH', 'EXPENSES']) expect(isFeaturePrefix(prefix)).toBe(true)
    for (const prefix of ['A', 'auth', 'AUTH1', 'EXPENSESX', 'AU TH', '', 7, null]) expect(isFeaturePrefix(prefix)).toBe(false)
  })
})

describe('defaultFeaturePrefix', () => {
  test('the project key is cut to eight letters', () => {
    expect(defaultFeaturePrefix('EXP')).toBe('EXP')
    expect(defaultFeaturePrefix('EXPENSESAP')).toBe('EXPENSES')
  })
})

describe('formatFeatureCode', () => {
  test('the number has at least three digits', () => {
    expect(formatFeatureCode('AUTH', 1)).toBe('AUTH-001')
    expect(formatFeatureCode('AUTH', 42)).toBe('AUTH-042')
    expect(formatFeatureCode('AUTH', 1234)).toBe('AUTH-1234')
  })
})

describe('parseFeatureCode', () => {
  test('reads a code in any case, with spaces around it', () => {
    expect(parseFeatureCode('AUTH-001')).toEqual({ prefix: 'AUTH', number: 1 })
    expect(parseFeatureCode(' auth-012 ')).toEqual({ prefix: 'AUTH', number: 12 })
  })

  test('refuses anything else', () => {
    for (const value of ['AUTH-1', 'AUTH-000', 'A-001', 'AUTH001', 'AUTH-001-BE-1', 'EXP-12']) expect(parseFeatureCode(value)).toBeNull()
  })
})
