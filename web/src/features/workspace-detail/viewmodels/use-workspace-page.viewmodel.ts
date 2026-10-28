import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { type AppRoute, WORKSPACE_TABS, type WorkspaceTab } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import { readErrorMessage } from '@/shared/utils/error-message'
import { TEAM_TEXT } from '../constants/team-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { useInviteDialogViewModel } from './use-invite-dialog.viewmodel'
import { useWorkspaceActionsViewModel } from './use-workspace-actions.viewmodel'
import { useWorkspaceActivityViewModel } from './use-workspace-activity.viewmodel'
import { useWorkspaceDetailViewModel } from './use-workspace-detail.viewmodel'
import { workspaceDetailKeys } from './workspace-detail.keys'

export function useWorkspacePageViewModel(workspaceId: string, tab: WorkspaceTab, navigate: (route: AppRoute, replace?: boolean) => void) {
  const { t } = useTranslation()
  const detail = useWorkspaceDetailViewModel(workspaceId)
  const token = useAuthSessionStore((state) => state.token)
  const visibleTabs: readonly WorkspaceTab[] = detail.isOwner ? WORKSPACE_TABS : WORKSPACE_TABS.filter((item) => item !== 'settings')
  const activeTab: WorkspaceTab = tab === 'settings' && !detail.isOwner ? 'overview' : tab

  const invitesQuery = useQuery({
    queryKey: workspaceDetailKeys.invites(token, workspaceId),
    queryFn: () => workspaceDetailService.invites(token, workspaceId),
    enabled: token !== '' && activeTab === 'team' && detail.isOwner,
  })
  const actions = useWorkspaceActionsViewModel(workspaceId, () => navigate({ page: 'workspaces' }))
  const inviteDialog = useInviteDialogViewModel(workspaceId)
  const activity = useWorkspaceActivityViewModel(workspaceId, detail.commits, activeTab === 'activity')

  return {
    ...detail,
    activeTab,
    visibleTabs,
    selectTab: (next: WorkspaceTab) => navigate({ page: 'workspace', workspaceId, tab: next }),
    invites: invitesQuery.data ?? [],
    invitesLoading: invitesQuery.isPending && invitesQuery.fetchStatus !== 'idle',
    invitesError: invitesQuery.error ? readErrorMessage(invitesQuery.error, t(TEAM_TEXT.toast.invitesFailed)) : null,
    actions,
    inviteDialog,
    activity,
  }
}
