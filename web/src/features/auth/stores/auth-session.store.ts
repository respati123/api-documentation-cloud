import { create } from 'zustand'
import type { CloudUser } from '@/shared/models/user.model'

// The session is an HttpOnly cookie that the browser sends by itself, so the page never holds a token.
// token stays empty. It is kept only so service signatures do not change. Check signedIn for a session.
interface AuthSessionState {
  token: string
  signedIn: boolean
  userId: string
  isAdmin: boolean
  sessionExpired: boolean
  saveSession: (user: CloudUser) => void
  clearSession: (options?: { expired?: boolean }) => void
}

// Tokens kept in sessionStorage by earlier versions are removed, so no old token stays on the page.
removeLegacyTokens()

export const useAuthSessionStore = create<AuthSessionState>((set) => ({
  token: '',
  signedIn: false,
  userId: '',
  isAdmin: false,
  sessionExpired: false,
  saveSession: (user) => set({ signedIn: true, userId: user.id, isAdmin: user.isAdmin === true, sessionExpired: false }),
  clearSession: (options) => set({ signedIn: false, userId: '', isAdmin: false, sessionExpired: options?.expired ?? false }),
}))

function removeLegacyTokens() {
  try {
    window.sessionStorage.removeItem('api-documentation-cloud-session')
    window.sessionStorage.removeItem('api-documentation-cloud-user-id')
  } catch {
    return
  }
}
