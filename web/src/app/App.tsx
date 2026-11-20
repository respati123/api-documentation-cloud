import { Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { AdminUsersPage } from '@/features/admin-users'
import { AdminWorkspacesPage } from '@/features/admin-workspaces'
import { AppShellView, SHELL_TEXT, useAppShellViewModel } from '@/features/app-shell'
import { AuthPage, isPasswordResetRoute, useAuthSessionViewModel } from '@/features/auth'
import { DESKTOP_TEXT, DesktopLoginPage, hasDesktopLoginRequest } from '@/features/desktop-login'
import { AdminMcpKeysPage, MyMcpKeyPage } from '@/features/mcp-access'
import { isOidcAuthorizeRoute, isOidcLogoutRoute, OIDC_AUTHORIZE_TEXT, OidcAuthorizePage, OidcLogoutPage } from '@/features/oidc-authorize'
import { usePendingInviteViewModel, WORKSPACE_TEXT, WorkspacePage } from '@/features/workspace-detail'
import { CreateWorkspaceDialog, WORKSPACES_TEXT, WorkspacesPage } from '@/features/workspaces'
import { LoadingState } from '@/shared/components/state-views'
import { useRealtimeConnection } from '@/shared/realtime/use-realtime-connection'
import { showToast } from '@/shared/toast/toast-manager'

export default function App() {
  const { t } = useTranslation()
  const session = useAuthSessionViewModel()
  const shell = useAppShellViewModel()
  const invite = usePendingInviteViewModel(shell.navigate)
  useRealtimeConnection(session.status === 'authenticated')

  if (session.status === 'checking') {
    return (
      <div className="p-6">
        <LoadingState label={t(SHELL_TEXT.session.checking)} testId="cloud-session-checking" />
      </div>
    )
  }

  // Sign-out works without a portal session, so it is checked before the sign-in screen.
  if (isOidcLogoutRoute(window.location.pathname)) return <OidcLogoutPage />

  // Another app sends the user here to sign in. The page completes the sign-in once the user is signed in to the portal.
  if (isOidcAuthorizeRoute(window.location.pathname)) {
    if (session.status !== 'authenticated') return <AuthPage inviteMessage={t(OIDC_AUTHORIZE_TEXT.signInPrompt)} />
    return <OidcAuthorizePage />
  }

  const desktopRequested = hasDesktopLoginRequest(window.location.search)
  const registrationToken = window.location.pathname === '/join' ? new URLSearchParams(window.location.search).get('token') || null : null
  if (session.status !== 'authenticated' || isPasswordResetRoute()) {
    const inviteMessage = invite.hasPendingInvite
      ? t(WORKSPACE_TEXT.invite.signInPrompt)
      : desktopRequested
        ? t(DESKTOP_TEXT.signInPrompt)
        : null
    return <AuthPage inviteMessage={inviteMessage} inviteToken={registrationToken} />
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
        currentWorkspace={shell.currentWorkspace}
        sidebarItems={shell.sidebarItems}
        expandedGroups={shell.expandedGroups}
        onGroupExpandedChange={shell.setGroupExpanded}
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
        {shell.route.page === 'overview' && <WorkspacesPage variant="overview" onOpenWorkspace={openWorkspace} />}
        {shell.route.page === 'workspaces' && <WorkspacesPage variant="list" onOpenWorkspace={openWorkspace} />}
        {shell.route.page === 'mcp' && <MyMcpKeyPage />}
        {shell.route.page === 'admin-mcp' && <AdminMcpKeysPage />}
        {shell.route.page === 'admin-workspaces' && <AdminWorkspacesPage onOpenWorkspace={openWorkspace} />}
        {shell.route.page === 'admin-users' && <AdminUsersPage />}
        {shell.route.page === 'workspace' && (
          <Suspense fallback={<LoadingState label={t(WORKSPACE_TEXT.state.loading)} />}>
            <WorkspacePage
              key={shell.route.workspaceId}
              workspaceId={shell.route.workspaceId}
              tab={shell.route.tab ?? 'overview'}
              commitId={shell.route.commitId}
              navigate={shell.navigate}
            />
          </Suspense>
        )}
      </AppShellView>
      <CreateWorkspaceDialog
        onCreated={(workspace) => {
          shell.navigate({ page: 'workspace', workspaceId: workspace.id, tab: 'overview' })
          showToast({ kind: 'success', message: t(WORKSPACES_TEXT.create.ready, { name: workspace.name }) })
        }}
      />
    </>
  )
}
