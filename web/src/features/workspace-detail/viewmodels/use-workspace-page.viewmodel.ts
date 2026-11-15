import { useTranslation } from 'react-i18next'
import type { AppRoute, WorkspaceTab } from '@/features/app-shell'
import { useProjectRolesViewModel, useProjectsViewModel } from '@/features/projects'
import { useWorkspaceHistoryViewModel } from '@/features/workspace-detail/viewmodels/use-workspace-history.viewmodel'
import { readErrorMessage } from '@/shared/utils/error-message'
import { TEAM_TEXT } from '../constants/team-text.constants'
import { useInviteDialogViewModel } from './use-invite-dialog.viewmodel'
import { useWorkspaceActionsViewModel } from './use-workspace-actions.viewmodel'
import { useWorkspaceDetailViewModel } from './use-workspace-detail.viewmodel'
import { useWorkspaceInvitesList } from './use-workspace-lists.viewmodel'
import { useWorkspaceLiveSync } from './use-workspace-live-sync.viewmodel'

export function useWorkspacePageViewModel(
  workspaceId: string,
  tab: WorkspaceTab,
  commitId: string | undefined,
  navigate: (route: AppRoute, replace?: boolean) => void,
) {
  const { t } = useTranslation()
  const detail = useWorkspaceDetailViewModel(workspaceId, tab)
  const activeTab: WorkspaceTab = tab === 'settings' && !detail.isOwner ? 'overview' : tab

  const invites = useWorkspaceInvitesList(workspaceId, activeTab === 'team' && detail.isOwner)
  const actions = useWorkspaceActionsViewModel(workspaceId, () => navigate({ page: 'workspaces' }))
  const inviteDialog = useInviteDialogViewModel(workspaceId)
  const history = useWorkspaceHistoryViewModel({
    workspaceId,
    commits: detail.commits,
    enabled: activeTab === 'history',
    commitId,
    // Restore works on the workspace head, which a branch workspace does not move. It is hidden until branch restore exists.
    canRestore: detail.workspace?.role !== 'viewer' && !detail.workspace?.usesBranches && detail.snapshot?.adminView !== true,
    onOpenCommit: (nextCommitId) => navigate({ page: 'workspace', workspaceId, tab: 'history', commitId: nextCommitId }),
    onOpenList: () => navigate({ page: 'workspace', workspaceId, tab: 'history' }),
    onRestore: (restoreId) => actions.restoreCommit.mutate(restoreId),
  })
  const liveStatus = useWorkspaceLiveSync(workspaceId)
  const projects = useProjectsViewModel(
    workspaceId,
    detail.workspace?.name ?? '',
    detail.workspace?.role !== 'viewer',
    activeTab === 'projects',
  )
  const projectRoles = useProjectRolesViewModel(workspaceId, detail.workspace?.role === 'owner', activeTab === 'team')

  return {
    ...detail,
    activeTab,
    canInvite: activeTab === 'team' && detail.workspace?.role === 'owner',
    selectTab: (next: WorkspaceTab) => navigate({ page: 'workspace', workspaceId, tab: next }),
    invites: invites.items,
    invitesHasMore: invites.hasMore,
    invitesLoadingMore: invites.isLoadingMore,
    loadMoreInvites: invites.loadMore,
    invitesLoading: invites.isPending && invites.items.length === 0 && !invites.isError,
    invitesError: invites.error ? readErrorMessage(invites.error, t(TEAM_TEXT.toast.invitesFailed)) : null,
    actions,
    inviteDialog,
    history,
    liveStatus,
    projects,
    projectRoles,
  }
}
