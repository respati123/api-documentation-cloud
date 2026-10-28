import { useAuthPageViewModel } from '../viewmodels/use-auth-page.viewmodel'
import { AuthView } from '../views/auth.view'

export function AuthPage({ inviteMessage }: { inviteMessage: string | null }) {
  const vm = useAuthPageViewModel()
  return (
    <AuthView
      mode={vm.mode}
      isBusy={vm.isBusy}
      errorMessage={vm.errorMessage}
      noticeMessage={vm.noticeMessage}
      inviteMessage={inviteMessage}
      onModeChange={vm.changeMode}
      onSubmit={vm.handleSubmit}
    />
  )
}
