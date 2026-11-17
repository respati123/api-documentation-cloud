import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OIDC_LOGOUT_TEXT } from '@/features/oidc-authorize/constants/oidc-logout-text.constants'
import { oidcLogoutService } from '@/features/oidc-authorize/services/oidc-logout.service'
import { readErrorMessage } from '@/shared/utils/error-message'

// Runs once per sign-out. The full page load that follows the redirect clears all portal state, so nothing cached needs clearing here.
export function useOidcLogoutViewModel() {
  const { t } = useTranslation()
  const [values] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search)))

  const endSession = useQuery({
    queryKey: ['oidc-logout', window.location.search],
    queryFn: () => oidcLogoutService.endSession(values),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    if (endSession.data) window.location.assign(endSession.data)
  }, [endSession.data])

  return {
    isWorking: !endSession.isError,
    errorMessage: endSession.error ? readErrorMessage(endSession.error, t(OIDC_LOGOUT_TEXT.failed)) : null,
    retry: () => void endSession.refetch(),
  }
}
