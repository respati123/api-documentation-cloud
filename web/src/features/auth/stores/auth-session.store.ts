import { create } from 'zustand'
import type { CloudUser } from '@/shared/models/user.model'

const tokenStorageKey = 'api-documentation-cloud-session'
const userIdStorageKey = 'api-documentation-cloud-user-id'

interface AuthSessionState {
  token: string
  userId: string
  sessionExpired: boolean
  saveSession: (token: string, user: CloudUser) => void
  clearSession: (options?: { expired?: boolean }) => void
}

export const useAuthSessionStore = create<AuthSessionState>((set) => ({
  token: readStorage(tokenStorageKey),
  userId: readStorage(userIdStorageKey),
  sessionExpired: false,
  saveSession: (token, user) => {
    writeStorage(tokenStorageKey, token)
    writeStorage(userIdStorageKey, user.id)
    set({ token, userId: user.id, sessionExpired: false })
  },
  clearSession: (options) => {
    writeStorage(tokenStorageKey, '')
    writeStorage(userIdStorageKey, '')
    set({ token: '', userId: '', sessionExpired: options?.expired ?? false })
  },
}))

function readStorage(key: string): string {
  try {
    return window.sessionStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}

function writeStorage(key: string, value: string) {
  try {
    if (value) window.sessionStorage.setItem(key, value)
    else window.sessionStorage.removeItem(key)
  } catch {
    return
  }
}
