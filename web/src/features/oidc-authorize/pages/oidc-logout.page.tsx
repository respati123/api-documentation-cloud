import { useOidcLogoutViewModel } from '@/features/oidc-authorize/viewmodels/use-oidc-logout.viewmodel'
import { OidcLogoutView } from '@/features/oidc-authorize/views/oidc-logout.view'

export function OidcLogoutPage() {
  const vm = useOidcLogoutViewModel()
  return <OidcLogoutView isWorking={vm.isWorking} errorMessage={vm.errorMessage} onRetry={vm.retry} />
}
