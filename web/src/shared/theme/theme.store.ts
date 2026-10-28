import { create } from 'zustand'
import {
  applyThemeClass,
  type ResolvedTheme,
  readStoredPreference,
  resolveTheme,
  type ThemePreference,
  writeStoredPreference,
} from './theme'

const darkQuery = '(prefers-color-scheme: dark)'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(darkQuery).matches
}

interface ThemeState {
  preference: ThemePreference
  resolved: ResolvedTheme
  setPreference: (preference: ThemePreference) => void
}

export const useThemeStore = create<ThemeState>((set) => ({
  preference: 'system',
  resolved: 'light',
  setPreference: (preference) => {
    writeStoredPreference(window.localStorage, preference)
    const resolved = resolveTheme(preference, systemPrefersDark())
    applyThemeClass(document.documentElement, resolved)
    set({ preference, resolved })
  },
}))

// Call once before the first render, so the page never flashes the wrong theme.
export function initTheme(): void {
  const preference = readStoredPreference(window.localStorage)
  const resolved = resolveTheme(preference, systemPrefersDark())
  applyThemeClass(document.documentElement, resolved)
  useThemeStore.setState({ preference, resolved })

  const media = window.matchMedia(darkQuery)
  media.addEventListener('change', () => {
    const current = useThemeStore.getState().preference
    if (current !== 'system') return
    const next = resolveTheme(current, media.matches)
    applyThemeClass(document.documentElement, next)
    useThemeStore.setState({ resolved: next })
  })
}
