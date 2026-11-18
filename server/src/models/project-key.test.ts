import { describe, expect, test } from 'bun:test'
import { isProjectKey, makeProjectKey } from '@/models/project-key'

describe('makeProjectKey', () => {
  test('a name with several words uses their initials', () => {
    expect(makeProjectKey('Pari Mobile App', [])).toBe('PMA')
    expect(makeProjectKey('toko online  baru', [])).toBe('TOB')
  })

  test('initials stop at six letters', () => {
    expect(makeProjectKey('a b c d e f g h', [])).toBe('ABCDEF')
  })

  test('a one-word name uses its first four letters', () => {
    expect(makeProjectKey('Dashboard', [])).toBe('DASH')
    expect(makeProjectKey('Pari', [])).toBe('PARI')
    expect(makeProjectKey('API', [])).toBe('API')
  })

  test('only plain letters count, so accents and digits are dropped', () => {
    expect(makeProjectKey('Çafé Åpp', [])).toBe('AP')
    expect(makeProjectKey('Web 2 Mobile', [])).toBe('WM')
  })

  test('a name with fewer than two usable letters becomes PRJ', () => {
    expect(makeProjectKey('123 !!', [])).toBe('PRJ')
    expect(makeProjectKey('X', [])).toBe('PRJ')
    expect(makeProjectKey('', [])).toBe('PRJ')
  })

  test('a taken key gets a two-letter suffix that counts up', () => {
    expect(makeProjectKey('Pari Mobile App', ['PMA'])).toBe('PMAAA')
    expect(makeProjectKey('Pari Mobile App', ['PMA', 'PMAAA'])).toBe('PMAAB')
    expect(makeProjectKey('Pari Mobile App', ['PMA', 'PMAAA', 'PMAAB'])).toBe('PMAAC')
  })

  test('every key it makes is valid', () => {
    for (const name of ['Pari Mobile App', 'a b c d e f g h', '123', 'Dashboard', 'Çafé']) {
      expect(isProjectKey(makeProjectKey(name, []))).toBe(true)
    }
  })
})

describe('isProjectKey', () => {
  test('a key is 2 to 10 capital letters', () => {
    for (const key of ['AB', 'PARI', 'ABCDEFGHIJ']) expect(isProjectKey(key)).toBe(true)
    for (const key of ['A', 'ab', 'AB1', 'ABCDEFGHIJK', 'A B', '', 7, null]) expect(isProjectKey(key)).toBe(false)
  })
})
