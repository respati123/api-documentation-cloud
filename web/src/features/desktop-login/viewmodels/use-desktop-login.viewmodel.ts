import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { AppRoute } from '@/features/app-shell'
import { readErrorMessage } from '@/shared/utils/error-message'
import { DESKTOP_TEXT } from '../constants/desktop-login-text.constants'
import { desktopLoginService } from '../services/desktop-login.service'
import { desktopSignInLink, isDesktopSignInRedirect } from '../utils/desktop-redirect'

// The desktop app opens this page with ?desktopLoginState=...&redirect=...&pk=... When the state is present, the approval step replaces the portal.
export function useDesktopLoginViewModel(navigate: (route: AppRoute, replace?: boolean) => void) {
  const { t } = useTranslation()
  const params = new URLSearchParams(window.location.search)
  const [loginState, setLoginState] = useState(() => params.get('desktopLoginState') ?? '')
  const [redirect] = useState(() => params.get('redirect') ?? '')
  const [publicKey] = useState(() => params.get('pk') ?? '')

  const invalidRedirect = !isDesktopSignInRedirect(redirect) || publicKey === ''

  const approve = useMutation({
    mutationFn: async () => {
      // The sealed session goes back to the desktop app through its own address. The browser asks the user to open the app.
      const box = await desktopLoginService.approve(publicKey)
      const link = desktopSignInLink(loginState, box)
      window.location.href = link
      return link
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
