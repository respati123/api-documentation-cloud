import type { DiffLayout } from '@/features/workspace-detail/models/history.model'

const LAYOUT_KEY = 'cloud.history.diffLayout'

export function readDiffLayout(): DiffLayout {
  try {
    return window.localStorage.getItem(LAYOUT_KEY) === 'unified' ? 'unified' : 'split'
  } catch {
    return 'split'
  }
}

export function writeDiffLayout(layout: DiffLayout) {
  try {
    window.localStorage.setItem(LAYOUT_KEY, layout)
  } catch {
    // The choice only lasts for this visit.
  }
}
