import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import type { AuthUser } from '../models/auth.model'
import { authService } from '../services/auth.service'
import { useAuthSessionStore } from '../stores/auth-session.store'
import { shouldEndSession } from '../utils/session-errors'

export const authKeys = {
  all: ['auth'] as const,
  currentUser: (token: string) => [...authKeys.all, 'current-user', token] as const,
}

export type SessionStatus = 'anonymous' | 'checking' | 'authenticated'

export function useAuthSessionViewModel(): {
  status: SessionStatus
  user: AuthUser | undefined
  token: string
  signOut: () => Promise<void>
} {
  const queryClient = useQueryClient()
  const token = useAuthSessionStore((state) => state.token)
  const clearSession = useAuthSessionStore((state) => state.clearSession)

  const currentUser = useQuery({
    queryKey: authKeys.currentUser(token),
    queryFn: () => authService.currentUser(token),
    enabled: token !== '',
    staleTime: 5 * 60_000,
    retry: false,
  })

  const sessionEnded = currentUser.isError && shouldEndSession(currentUser.error)
  useEffect(() => {
    if (sessionEnded) clearSession({ expired: true })
  }, [sessionEnded, clearSession])

  const status: SessionStatus =
    token === '' ? 'anonymous' : currentUser.isPending ? 'checking' : currentUser.isSuccess ? 'authenticated' : 'anonymous'

  async function signOut() {
    if (token) await authService.logout(token).catch(() => undefined)
    clearSession()
    queryClient.removeQueries({ queryKey: authKeys.all })
  }

  return { status, user: currentUser.data, token, signOut }
}
