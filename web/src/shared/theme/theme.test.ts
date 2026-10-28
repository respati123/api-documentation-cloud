import { describe, expect, test } from 'vitest'
import { applyThemeClass, readStoredPreference, resolveTheme, writeStoredPreference } from './theme'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('resolveTheme', () => {
  test('follows the system when the preference is system', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  test('ignores the system when the user picked a theme', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
})

describe('readStoredPreference', () => {
  test('defaults to system when nothing is stored', () => {
    expect(readStoredPreference(memoryStorage())).toBe('system')
  })

  test('returns a stored valid preference', () => {
    expect(readStoredPreference(memoryStorage({ 'api-documentation-cloud-theme': 'light' }))).toBe('light')
  })

  test('falls back to system for an unknown stored value', () => {
    expect(readStoredPreference(memoryStorage({ 'api-documentation-cloud-theme': 'sepia' }))).toBe('system')
  })

  test('falls back to system when storage cannot be read', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => undefined,
    }
    expect(readStoredPreference(broken)).toBe('system')
  })
})

describe('writeStoredPreference', () => {
  test('stores the preference under the theme key', () => {
    const storage = memoryStorage()
    writeStoredPreference(storage, 'dark')
    expect(storage.getItem('api-documentation-cloud-theme')).toBe('dark')
  })
})

describe('applyThemeClass', () => {
  test('adds the dark class for a dark theme and removes it for a light one', () => {
    const classes = new Set<string>()
    const element = {
      classList: {
        toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      },
    }

    applyThemeClass(element, 'dark')
    expect(classes.has('dark')).toBe(true)

    applyThemeClass(element, 'light')
    expect(classes.has('dark')).toBe(false)
  })
})
