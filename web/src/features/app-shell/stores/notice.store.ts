import { create } from 'zustand'

export type NoticeKind = 'success' | 'error' | 'info'

export interface Notice {
  kind: NoticeKind
  message: string
}

const NOTICE_DURATION_MS = 5500

interface NoticeState {
  notice: Notice | null
  show: (notice: Notice) => void
  dismiss: () => void
}

let dismissTimer: ReturnType<typeof setTimeout> | undefined

export const useNoticeStore = create<NoticeState>((set) => ({
  notice: null,
  show: (notice) => {
    clearTimeout(dismissTimer)
    set({ notice })
    dismissTimer = setTimeout(() => set({ notice: null }), NOTICE_DURATION_MS)
  },
  dismiss: () => {
    clearTimeout(dismissTimer)
    set({ notice: null })
  },
}))
