import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { AppShellView, NoticeBanner, SHELL_TEXT, useAppShellViewModel, useNoticeStore } from '@/features/app-shell'
import { AuthPage, isPasswordResetRoute, useAuthSessionViewModel } from '@/features/auth'
import { DESKTOP_TEXT, DesktopLoginPage, hasDesktopLoginRequest } from '@/features/desktop-login'
import { usePendingInviteViewModel, WORKSPACE_TEXT, WorkspacePage } from '@/features/workspace-detail'
import { CreateWorkspaceDialog, WORKSPACES_TEXT, WorkspacesPage } from '@/features/workspaces'
import { LoadingState } from '@/shared/components/state-views'

export default function App() {
  const { t } = useTranslation()
  const session = useAuthSessionViewModel()
  const shell = useAppShellViewModel()
  const invite = usePendingInviteViewModel(shell.navigate)
  const showNotice = useNoticeStore((state) => state.show)

  if (session.status === 'checking') {
    return (
      <div className="p-6">
        <LoadingState label={t(SHELL_TEXT.session.checking)} testId="cloud-session-checking" />
      </div>
    )
  }

  const desktopRequested = hasDesktopLoginRequest(window.location.search)
  if (session.status !== 'authenticated' || isPasswordResetRoute()) {
    const inviteMessage = invite.hasPendingInvite
      ? t(WORKSPACE_TEXT.invite.signInPrompt)
      : desktopRequested
        ? t(DESKTOP_TEXT.signInPrompt)
        : null
    return <AuthPage inviteMessage={inviteMessage} />
  }
  if (!session.user) return null
  if (desktopRequested) return <DesktopLoginPage email={session.user.email} navigate={shell.navigate} />

  const openWorkspace = (workspaceId: string) => shell.navigate({ page: 'workspace', workspaceId, tab: 'overview' })

  return (
    <>
      <AppShellView
        route={shell.route}
        user={session.user}
        workspaces={shell.workspaces}
        apiOnline={shell.apiOnline}
        mobileNavOpen={shell.mobileNavOpen}
        onMobileNavOpenChange={shell.setMobileNavOpen}
        onNavigate={shell.navigate}
        hasMoreWorkspaces={shell.hasMoreWorkspaces}
        isLoadingMoreWorkspaces={shell.isLoadingMoreWorkspaces}
        onLoadMoreWorkspaces={shell.loadMoreWorkspaces}
        onCreateWorkspace={shell.openCreateWorkspace}
        onSignOut={() => void shell.signOut()}
      >
        <NoticeBanner />
        {shell.route.page === 'overview' && <WorkspacesPage variant="overview" onOpenWorkspace={openWorkspace} />}
        {shell.route.page === 'workspaces' && <WorkspacesPage variant="list" onOpenWorkspace={openWorkspace} />}
        {shell.route.page === 'workspace' && (
          <Suspense fallback={<LoadingState label={t(WORKSPACE_TEXT.state.loading)} />}>
            <WorkspacePage
              key={shell.route.workspaceId}
              workspaceId={shell.route.workspaceId}
              tab={shell.route.tab ?? 'overview'}
              navigate={shell.navigate}
            />
          </Suspense>
        )}
      </AppShellView>
      <CreateWorkspaceDialog
        onCreated={(workspace) => {
          shell.navigate({ page: 'workspace', workspaceId: workspace.id, tab: 'overview' })
          showNotice({ kind: 'success', message: t(WORKSPACES_TEXT.create.ready, { name: workspace.name }) })
        }}
      />
    </>
  )
}
