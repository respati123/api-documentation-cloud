import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { portalService } from '../services/portal.service'
import { desktopSignInLink, readDesktopLoginRequest, type DesktopLoginRequest } from '../utils/desktop-login.utils'

// Approving a desktop sign-in hands the sealed session back through the desktop app's own address.
export function useDesktopLoginViewModel() {
  const [request, setRequest] = useState<DesktopLoginRequest | null>(() => readDesktopLoginRequest(window.location.search))

  const approve = useMutation({
    mutationFn: async () => {
      if (!request?.valid) throw new Error('This sign-in request is incomplete or not from the desktop app.')
      const box = await portalService.approveDesktopLogin(request.publicKey)
      return desktopSignInLink(request.state, box)
    },
    onSuccess: link => {
      window.location.href = link
    },
  })

  return {
    active: request !== null,
    invalid: request !== null && !request.valid,
    isBusy: approve.isPending,
    isDone: approve.isSuccess,
    error: approve.error?.message ?? null,
    approve: () => approve.mutate(),
    cancel: () => {
      window.history.replaceState({}, '', '/')
      setRequest(null)
    },
  }
}

export type DesktopLoginViewModel = ReturnType<typeof useDesktopLoginViewModel>
