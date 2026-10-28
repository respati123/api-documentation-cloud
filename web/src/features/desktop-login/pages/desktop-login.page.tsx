import type { AppRoute } from '@/features/app-shell'
import { useDesktopLoginViewModel } from '../viewmodels/use-desktop-login.viewmodel'
import { DesktopLoginView } from '../views/desktop-login.view'

export function DesktopLoginPage({ email, navigate }: { email: string; navigate: (route: AppRoute, replace?: boolean) => void }) {
  const vm = useDesktopLoginViewModel(navigate)
  return (
    <DesktopLoginView email={email} isBusy={vm.isBusy} isDone={vm.isDone} error={vm.error} onApprove={vm.approve} onCancel={vm.cancel} />
  )
}
