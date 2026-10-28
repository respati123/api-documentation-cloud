import { useTranslation } from 'react-i18next'
import { type AppRoute, WORKSPACE_TABS, type WorkspaceTab } from '@/features/app-shell'
import { readErrorMessage } from '@/shared/utils/error-message'
import { TEAM_TEXT } from '../constants/team-text.constants'
import { useInviteDialogViewModel } from './use-invite-dialog.viewmodel'
import { useWorkspaceActionsViewModel } from './use-workspace-actions.viewmodel'
import { useWorkspaceActivityViewModel } from './use-workspace-activity.viewmodel'
import { useWorkspaceDetailViewModel } from './use-workspace-detail.viewmodel'
import { useWorkspaceInvitesList } from './use-workspace-lists.viewmodel'

export function useWorkspacePageViewModel(workspaceId: string, tab: WorkspaceTab, navigate: (route: AppRoute, replace?: boolean) => void) {
  const { t } = useTranslation()
  const detail = useWorkspaceDetailViewModel(workspaceId, tab)
  const visibleTabs: readonly WorkspaceTab[] = detail.isOwner ? WORKSPACE_TABS : WORKSPACE_TABS.filter((item) => item !== 'settings')
  const activeTab: WorkspaceTab = tab === 'settings' && !detail.isOwner ? 'overview' : tab

  const invites = useWorkspaceInvitesList(workspaceId, activeTab === 'team' && detail.isOwner)
  const actions = useWorkspaceActionsViewModel(workspaceId, () => navigate({ page: 'workspaces' }))
  const inviteDialog = useInviteDialogViewModel(workspaceId)
  const activity = useWorkspaceActivityViewModel(workspaceId, detail.commits, activeTab === 'activity')

  return {
    ...detail,
    activeTab,
    visibleTabs,
    selectTab: (next: WorkspaceTab) => navigate({ page: 'workspace', workspaceId, tab: next }),
    invites: invites.items,
    invitesHasMore: invites.hasMore,
    invitesLoadingMore: invites.isLoadingMore,
    loadMoreInvites: invites.loadMore,
    invitesLoading: invites.isPending && invites.items.length === 0 && !invites.isError,
    invitesError: invites.error ? readErrorMessage(invites.error, t(TEAM_TEXT.toast.invitesFailed)) : null,
    actions,
    inviteDialog,
    activity,
  }
}
