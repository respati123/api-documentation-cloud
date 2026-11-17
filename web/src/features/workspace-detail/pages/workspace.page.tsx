import { useTranslation } from 'react-i18next'
import { DesignAppPage } from '@/features/app-integrations'
import { type AppRoute, SHELL_TEXT, type WorkspaceTab } from '@/features/app-shell'
import { ProjectsView } from '@/features/projects'
import { CommitDetailView } from '@/features/workspace-detail/views/commit-detail.view'
import { HistoryListView } from '@/features/workspace-detail/views/history-list.view'
import { Button } from '@/shared/components/primitives/button'
import { EmptyState, ErrorState, LoadingState } from '@/shared/components/state-views'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import { useWorkspacePageViewModel } from '../viewmodels/use-workspace-page.viewmodel'
import { ApiDocsView } from '../views/api-docs.view'
import { InviteDialogView } from '../views/invite-dialog.view'
import { WorkspaceSettingsView } from '../views/settings.view'
import { TeamView } from '../views/team.view'
import { WorkspaceOverviewView } from '../views/workspace-overview.view'
import { WorkspacePageView } from '../views/workspace-page.view'

export interface WorkspacePageProps {
  workspaceId: string
  tab: WorkspaceTab
  commitId?: string
  navigate: (route: AppRoute, replace?: boolean) => void
}

export function WorkspacePage({ workspaceId, tab, commitId, navigate }: WorkspacePageProps) {
  const { t } = useTranslation()
  const vm = useWorkspacePageViewModel(workspaceId, tab, commitId, navigate)

  if (vm.detailStatus === 'loading') return <LoadingState label={t(WORKSPACE_TEXT.state.loading)} testId="workspace-loading-state" />
  if (!vm.workspace && vm.detailStatus === 'error') {
    return (
      <ErrorState
        title={t(WORKSPACE_TEXT.state.errorTitle)}
        message={vm.detailError ?? ''}
        retryLabel={t(WORKSPACE_TEXT.state.retry)}
        onRetry={vm.refetchDetail}
        testId="workspace-view-error"
      />
    )
  }
  if (!vm.workspace) {
    return (
      <EmptyState
        title={t(SHELL_TEXT.unavailable.title)}
        detail={t(SHELL_TEXT.unavailable.detail)}
        testId="workspace-unavailable-state"
        action={
          <Button variant="outline" onClick={() => navigate({ page: 'workspaces' })}>
            {t(SHELL_TEXT.unavailable.back)}
          </Button>
        }
      />
    )
  }
  const { workspace, snapshot } = vm

  return (
    <WorkspacePageView
      workspace={workspace}
      adminView={vm.snapshot?.adminView === true}
      activeTab={vm.activeTab}
      canInvite={vm.canInvite}
      liveStatus={vm.liveStatus}
      onInvite={vm.inviteDialog.open}
    >
      {vm.detailStatus === 'loading' && <LoadingState label={t(WORKSPACE_TEXT.state.loadingView)} testId="workspace-view-loading" />}
      {vm.detailStatus === 'error' && (
        <ErrorState
          title={t(WORKSPACE_TEXT.state.errorTitle)}
          message={vm.detailError ?? ''}
          retryLabel={t(WORKSPACE_TEXT.state.retry)}
          onRetry={vm.refetchDetail}
          testId="workspace-view-error"
        />
      )}
      {vm.detailStatus === 'unavailable' && (
        <EmptyState
          title={t(WORKSPACE_TEXT.state.unavailableTitle)}
          detail={t(WORKSPACE_TEXT.state.unavailableDetail)}
          testId="workspace-data-unavailable"
        />
      )}
      {vm.detailStatus === 'ready' && snapshot && (
        <>
          {vm.activeTab === 'overview' && (
            <WorkspaceOverviewView
              workspace={workspace}
              snapshot={snapshot}
              requestCount={vm.counts.requests}
              folderCount={vm.counts.folders}
              memberCount={vm.members.length}
              commits={vm.commits}
              onTab={vm.selectTab}
            />
          )}
          {vm.activeTab === 'collections' && (
            <ApiDocsView
              tree={vm.tree}
              totalRequests={vm.counts.requests}
              query={vm.query}
              onQueryChange={vm.setQuery}
              selectedRequest={vm.selectedRequest}
              onSelect={vm.selectRequest}
            />
          )}
          {vm.activeTab === 'history' && vm.history.mode === 'list' && (
            <HistoryListView
              dayGroups={vm.history.dayGroups}
              commitCount={vm.history.commitCount}
              usesBranches={Boolean(workspace.usesBranches)}
              hasMore={vm.commitsHasMore}
              isLoadingMore={vm.commitsLoadingMore}
              onLoadMore={vm.loadMoreCommits}
              onOpenCommit={vm.history.onOpenCommit}
            />
          )}
          {vm.activeTab === 'history' && vm.history.mode === 'detail' && vm.history.commit && (
            <CommitDetailView
              commit={vm.history.commit}
              status={vm.history.status}
              error={vm.history.error}
              files={vm.history.files}
              tree={vm.history.tree}
              breakingChanges={vm.history.breakingChanges}
              breakingFileIds={vm.history.breakingFileIds}
              totals={vm.history.totals}
              layout={vm.history.layout}
              diffLayout={vm.history.diffLayout}
              canChooseLayout={vm.history.canChooseLayout}
              viewedIds={vm.history.viewedIds}
              collapsedIds={vm.history.collapsedIds}
              expandedGapKeys={vm.history.expandedGapKeys}
              canRestore={vm.history.canRestore}
              onBack={vm.history.onOpenList}
              onOpenCommit={vm.history.onOpenCommit}
              onRetry={vm.history.retry}
              onLayoutChange={vm.history.setLayout}
              onToggleViewed={vm.history.toggleViewed}
              onToggleCollapsed={vm.history.toggleCollapsed}
              onExpandGap={vm.history.expandGap}
              onJumpToFile={vm.history.onJumpToFile}
              onRestore={vm.history.onRestore}
            />
          )}
          {vm.activeTab === 'team' && (
            <TeamView
              workspaceName={workspace.name}
              isOwner={vm.isOwner}
              currentUserId={vm.userId}
              members={vm.members}
              membersLoading={false}
              invites={vm.invites}
              invitesLoading={vm.invitesLoading}
              invitesError={vm.invitesError}
              invitesHasMore={vm.invitesHasMore}
              invitesLoadingMore={vm.invitesLoadingMore}
              onLoadMoreInvites={vm.loadMoreInvites}
              membersHasMore={vm.membersHasMore}
              membersLoadingMore={vm.membersLoadingMore}
              onLoadMoreMembers={vm.loadMoreMembers}
              lastInviteLink={vm.inviteDialog.lastInviteLink}
              onInvite={vm.inviteDialog.open}
              onCancelInvite={vm.actions.cancelInvite.mutate}
              onChangeRole={(member, role) => vm.actions.changeRole.mutate({ memberId: member.id, email: member.email, role })}
              onRemoveMember={(member) =>
                vm.actions.removeMember.mutate({ memberId: member.id, email: member.email, workspaceName: workspace.name })
              }
              onCopyLink={() => void vm.inviteDialog.copyLink()}
              projectRoles={vm.projectRoles}
            />
          )}
          {vm.activeTab === 'settings' && vm.isOwner && (
            <WorkspaceSettingsView
              workspaceName={workspace.name}
              onRename={(name) => vm.actions.rename.mutate(name)}
              onDelete={(confirmName) => vm.actions.deleteWorkspace.mutate(confirmName)}
            />
          )}
        </>
      )}
      {vm.detailStatus === 'ready' && (vm.activeTab === 'design-ui' || vm.activeTab === 'design-database') && (
        <DesignAppPage key={vm.activeTab} workspaceId={workspaceId} app={vm.activeTab === 'design-ui' ? 'stitchkit' : 'dbdesign'} />
      )}
      {vm.detailStatus === 'ready' && vm.activeTab === 'projects' && (
        <ProjectsView {...vm.projects} onManageTeam={() => vm.selectTab('team')} />
      )}
      <InviteDialogView
        isOpen={vm.inviteDialog.isOpen}
        email={vm.inviteDialog.email}
        role={vm.inviteDialog.role}
        isBusy={vm.inviteDialog.isBusy}
        errorMessage={vm.inviteDialog.errorMessage}
        onEmailChange={vm.inviteDialog.setEmail}
        onRoleChange={vm.inviteDialog.setRole}
        onClose={vm.inviteDialog.close}
        onSubmit={vm.inviteDialog.submit}
      />
    </WorkspacePageView>
  )
}
