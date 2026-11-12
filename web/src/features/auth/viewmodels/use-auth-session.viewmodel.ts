import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { CloudUser } from '@/shared/models/user.model'
import { authService } from '../services/auth.service'
import { useAuthSessionStore } from '../stores/auth-session.store'
import { shouldEndSession } from '../utils/session-errors'

// The current user is read from the session cookie, so the key does not depend on any token.
export const authKeys = {
  all: ['auth'] as const,
  currentUser: () => [...authKeys.all, 'current-user'] as const,
}

export type SessionStatus = 'anonymous' | 'checking' | 'authenticated'

export function useAuthSessionViewModel(): {
  status: SessionStatus
  user: CloudUser | undefined
  token: string
  signOut: () => Promise<void>
} {
  const queryClient = useQueryClient()
  const token = useAuthSessionStore((state) => state.token)
  const saveSession = useAuthSessionStore((state) => state.saveSession)
  const clearSession = useAuthSessionStore((state) => state.clearSession)
  const signedIn = useAuthSessionStore((state) => state.signedIn)

  // Asks the server whether this browser has a session. A missing or expired cookie answers 401, which is anonymous, not an error.
  const currentUser = useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: () => authService.currentUser(''),
    staleTime: 5 * 60_000,
    retry: false,
  })

  // Only a session that was signed in and then answered 401 has expired. A first visit or a sign-out is not an expiry.
  const sessionEnded = currentUser.isError && shouldEndSession(currentUser.error)
  useEffect(() => {
    if (sessionEnded && signedIn) clearSession({ expired: true })
  }, [sessionEnded, signedIn, clearSession])

  useEffect(() => {
    if (currentUser.isSuccess && currentUser.data) saveSession(currentUser.data)
  }, [currentUser.isSuccess, currentUser.data, saveSession])

  const status: SessionStatus = currentUser.isPending ? 'checking' : currentUser.isSuccess ? 'authenticated' : 'anonymous'

  // The server ends this browser's session and clears its cookie. Other devices keep their sessions.
  // If the server refuses, the error reaches the caller and the screen keeps the session it still has.
  async function signOut() {
    await authService.logout('')
    clearSession()
    // resetQueries notifies mounted observers and refetches /api/me, which now answers 401.
    await queryClient.resetQueries({ queryKey: authKeys.all })
  }

  return { status, user: currentUser.data, token, signOut }
}
