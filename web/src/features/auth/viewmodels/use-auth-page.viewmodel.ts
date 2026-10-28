import { useMutation, useQueryClient } from '@tanstack/react-query'
import { type FormEvent, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { COMMON_TEXT } from '@/shared/constants/common-text.constants'
import { ApiError } from '@/shared/services/api-client'
import { AUTH_TEXT } from '../constants/auth-text.constants'
import type { AuthMode } from '../models/auth.model'
import { authService } from '../services/auth.service'
import { useAuthSessionStore } from '../stores/auth-session.store'
import { isPasswordResetRoute, readResetToken } from '../utils/password-reset-route'
import { authKeys } from './use-auth-session.viewmodel'

interface AuthSubmission {
  mode: AuthMode
  email: string
  password: string
  resetToken: string
}

export function useAuthPageViewModel() {
  const { t } = useTranslation(['auth', 'common'])
  const queryClient = useQueryClient()
  const saveSession = useAuthSessionStore((state) => state.saveSession)
  const clearSession = useAuthSessionStore((state) => state.clearSession)
  const sessionExpired = useAuthSessionStore((state) => state.sessionExpired)

  const [mode, setMode] = useState<AuthMode>(() => (isPasswordResetRoute() ? 'reset' : 'login'))
  const [resetToken] = useState(readResetToken)
  const [notice, setNotice] = useState<string | null>(null)

  const submission = useMutation({
    mutationFn: async ({ mode: action, email, password, resetToken: token }: AuthSubmission) => {
      if (action === 'login') return authService.login(email, password)
      if (action === 'register') return authService.register(email, password)
      if (action === 'forgot') return authService.requestPasswordReset(email)
      return authService.resetPassword(token, password)
    },
    onSuccess: (result, variables) => {
      setNotice(null)
      if (variables.mode === 'login' || variables.mode === 'register') {
        if (!result) return
        queryClient.setQueryData(authKeys.currentUser(result.token), result.user)
        saveSession(result.token, result.user)
        return
      }
      if (variables.mode === 'forgot') {
        setNotice(t(AUTH_TEXT.notice.resetSent))
        return
      }
      clearSession()
      window.history.replaceState({}, '', '/')
      setMode('login')
      setNotice(t(AUTH_TEXT.notice.passwordUpdated))
    },
  })

  function changeMode(next: AuthMode) {
    setMode(next)
    setNotice(null)
    submission.reset()
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    submission.mutate({
      mode,
      email: String(form.get('email') ?? ''),
      password: String(form.get('password') ?? ''),
      resetToken,
    })
  }

  return {
    mode,
    changeMode,
    handleSubmit,
    isBusy: submission.isPending,
    errorMessage: submission.error ? readErrorMessage(submission.error, t(COMMON_TEXT.error.unexpected)) : null,
    noticeMessage: notice ?? (sessionExpired && mode === 'login' ? t(AUTH_TEXT.notice.sessionExpired) : null),
  }
}

function readErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  return fallback
}
