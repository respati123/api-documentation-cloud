import { describe, expect, test } from 'bun:test'
import { negotiateLocale } from './locale'

describe('negotiateLocale', () => {
  test('defaults to English without a header', () => {
    expect(negotiateLocale(null)).toBe('en')
  })

  test('picks Indonesian for an Indonesian region tag', () => {
    expect(negotiateLocale('id-ID,en;q=0.8')).toBe('id')
  })

  test('falls back to English for an unsupported language', () => {
    expect(negotiateLocale('fr-FR,en;q=0.5')).toBe('en')
  })

  test('respects quality values over list order', () => {
    expect(negotiateLocale('en;q=0.4,id;q=0.9')).toBe('id')
  })

  test('ignores malformed entries', () => {
    expect(negotiateLocale(';;;,id')).toBe('id')
  })
})
