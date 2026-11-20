import { useAuthPageViewModel } from '../viewmodels/use-auth-page.viewmodel'
import { AuthView } from '../views/auth.view'

export function AuthPage({ inviteMessage, inviteToken = null }: { inviteMessage: string | null; inviteToken?: string | null }) {
  const vm = useAuthPageViewModel(inviteToken)
  return (
    <AuthView
      mode={vm.mode}
      isBusy={vm.isBusy}
      errorMessage={vm.errorMessage}
      noticeMessage={vm.noticeMessage}
      inviteMessage={inviteMessage}
      allowRegistration={vm.allowRegistration}
      onModeChange={vm.changeMode}
      onSubmit={vm.handleSubmit}
    />
  )
}
