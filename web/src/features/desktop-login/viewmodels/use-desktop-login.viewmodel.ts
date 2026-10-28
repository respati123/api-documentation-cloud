import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppRoute } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import { readErrorMessage } from '@/shared/utils/error-message'
import { DESKTOP_TEXT } from '../constants/desktop-login-text.constants'
import { desktopLoginService } from '../services/desktop-login.service'
import { isDesktopLoopbackRedirect } from '../utils/desktop-redirect'

// The desktop app opens this page with ?desktopLoginState=...&redirect=... When the state is present, the approval step replaces the portal.
export function useDesktopLoginViewModel(navigate: (route: AppRoute, replace?: boolean) => void) {
  const { t } = useTranslation()
  const token = useAuthSessionStore((state) => state.token)
  const params = new URLSearchParams(window.location.search)
  const [loginState, setLoginState] = useState(() => params.get('desktopLoginState') ?? '')
  const [redirect] = useState(() => params.get('redirect') ?? '')

  const invalidRedirect = !isDesktopLoopbackRedirect(redirect)

  const approve = useMutation({
    mutationFn: async () => {
      const code = await desktopLoginService.approve(token)
      const callback = new URL(redirect)
      callback.searchParams.set('state', loginState)
      callback.searchParams.set('code', code)
      window.location.href = callback.toString()
      return callback.toString()
    },
  })

  function cancel() {
    setLoginState('')
    navigate({ page: 'overview' }, true)
  }

  return {
    isActive: loginState !== '',
    isBusy: approve.isPending,
    isDone: approve.isSuccess,
    error: invalidRedirect ? t(DESKTOP_TEXT.notDesktop) : approve.error ? readErrorMessage(approve.error, t(DESKTOP_TEXT.failed)) : null,
    approve: () => {
      if (!invalidRedirect) approve.mutate()
    },
    cancel,
  }
}
