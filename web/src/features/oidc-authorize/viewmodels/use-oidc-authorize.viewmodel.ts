import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OIDC_AUTHORIZE_TEXT } from '@/features/oidc-authorize/constants/oidc-authorize-text.constants'
import { oidcAuthorizeService } from '@/features/oidc-authorize/services/oidc-authorize.service'
import { readErrorMessage } from '@/shared/utils/error-message'

// Runs once per sign-in. The result is a redirect, not data to keep, so the query never refetches on its own.
export function useOidcAuthorizeViewModel() {
  const { t } = useTranslation()
  const [values] = useState(() => Object.fromEntries(new URLSearchParams(window.location.search)))

  const authorize = useQuery({
    queryKey: ['oidc-authorize', window.location.search],
    queryFn: () => oidcAuthorizeService.authorize(values),
    staleTime: Number.POSITIVE_INFINITY,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  useEffect(() => {
    if (authorize.data) window.location.assign(authorize.data)
  }, [authorize.data])

  return {
    // Working until the request fails. A success is followed by the redirect, so it still counts as working.
    isWorking: !authorize.isError,
    errorMessage: authorize.error ? readErrorMessage(authorize.error, t(OIDC_AUTHORIZE_TEXT.failed)) : null,
    retry: () => void authorize.refetch(),
  }
}
