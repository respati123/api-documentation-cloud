import { useOidcAuthorizeViewModel } from '@/features/oidc-authorize/viewmodels/use-oidc-authorize.viewmodel'
import { OidcAuthorizeView } from '@/features/oidc-authorize/views/oidc-authorize.view'

export function OidcAuthorizePage() {
  const vm = useOidcAuthorizeViewModel()
  return <OidcAuthorizeView isWorking={vm.isWorking} errorMessage={vm.errorMessage} onRetry={vm.retry} />
}
