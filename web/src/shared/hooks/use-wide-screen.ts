import { useSyncExternalStore } from 'react'

// Tailwind's md breakpoint. Below it, side-by-side layouts are too narrow to read.
const WIDE_QUERY = '(min-width: 768px)'

function mediaQuery(): MediaQueryList | null {
  return typeof window.matchMedia === 'function' ? window.matchMedia(WIDE_QUERY) : null
}

function subscribe(callback: () => void) {
  const query = mediaQuery()
  query?.addEventListener('change', callback)
  return () => query?.removeEventListener('change', callback)
}

export function useWideScreen(): boolean {
  return useSyncExternalStore(subscribe, () => mediaQuery()?.matches ?? true)
}
