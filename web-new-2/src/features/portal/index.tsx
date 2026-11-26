import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PortalView } from './views/portal.view'
import { AuthView } from './views/auth.view'
import { ErrorView, LoadingView } from './views/state.view'
import { usePortalViewModel } from './hooks/use-portal.viewmodel'
import { useDesktopLoginViewModel } from './hooks/use-desktop-login.viewmodel'
import { DesktopLoginView } from './views/desktop-login.view'

export function PortalPage() {
  const { t } = useTranslation()
  const vm = usePortalViewModel()
  const desktop = useDesktopLoginViewModel()

  if (vm.me.isPending) return <LoadingView />
  if (vm.me.error && !vm.anonymous) {
    return <ErrorView error={vm.me.error} retry={() => void vm.me.refetch()} />
  }

  if (vm.pendingInviteToken && vm.acceptWorkspaceInvite.error) {
    return (
      <Card role="main" data-testid="workspace-invite-error-container" className="m-8">
        <CardHeader>
          <CardTitle>{t('invite.errorTitle')}</CardTitle>
          <CardDescription>{t('invite.errorDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ErrorView
            error={vm.acceptWorkspaceInvite.error}
            retry={vm.retryWorkspaceInvite}
            testId="workspace-invite-accept-error"
          />
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={vm.logout.isPending}
            onClick={() => vm.logout.mutate()}
            data-testid="workspace-invite-switch-account-button"
          >
            {vm.logout.isPending ? t('auth.signingOut') : t('invite.switchAccount')}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="cursor-pointer"
            onClick={vm.dismissWorkspaceInvite}
            data-testid="workspace-invite-dismiss-button"
          >
            {t('invite.continueToWorkspaces')}
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (vm.pendingInviteToken && vm.authenticated) {
    return (
      <Card role="main" data-testid="workspace-invite-accepting-container" className="m-8">
        <CardHeader>
          <CardTitle>{t('invite.joiningTitle')}</CardTitle>
          <CardDescription>{t('invite.acceptingDescription')}</CardDescription>
        </CardHeader>
        <CardContent><LoadingView /></CardContent>
      </Card>
    )
  }

  if (vm.authenticated && desktop.active) return <DesktopLoginView email={vm.me.data?.email ?? ''} vm={desktop} />
  if (!vm.authenticated || vm.mode === 'reset') return <AuthView vm={vm} />
  return <PortalView vm={vm} />
}
