export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'

export const themeStorageKey = 'api-documentation-cloud-theme'
const preferences: readonly ThemePreference[] = ['system', 'light', 'dark']

export interface KeyValueStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

export function readStoredPreference(storage: KeyValueStorage): ThemePreference {
  try {
    const value = storage.getItem(themeStorageKey)
    return preferences.find((preference) => preference === value) ?? 'system'
  } catch {
    return 'system'
  }
}

export function writeStoredPreference(storage: KeyValueStorage, preference: ThemePreference): void {
  try {
    storage.setItem(themeStorageKey, preference)
  } catch {
    // Storage can be blocked. The theme still applies for this page view.
  }
}

// Tokens for dark mode live under .dark in index.css, so the class is the only switch.
export function applyThemeClass(element: { classList: { toggle: (name: string, on: boolean) => unknown } }, theme: ResolvedTheme): void {
  element.classList.toggle('dark', theme === 'dark')
}
