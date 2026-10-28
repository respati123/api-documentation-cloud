import { useAuthSessionStore } from '@/features/auth'
import { usePageList } from '@/shared/hooks/use-page-list'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { workspaceDetailKeys } from './workspace-detail.keys'

export function useWorkspaceHistoryList(workspaceId: string, enabled: boolean) {
  const token = useAuthSessionStore((state) => state.token)
  return usePageList({
    queryKey: workspaceDetailKeys.history(token, workspaceId),
    fetchPage: (cursor) => workspaceDetailService.historyPage(token, workspaceId, cursor),
    enabled: enabled && token !== '' && workspaceId !== '',
  })
}

export function useWorkspaceMembersList(workspaceId: string, enabled: boolean) {
  const token = useAuthSessionStore((state) => state.token)
  return usePageList({
    queryKey: workspaceDetailKeys.members(token, workspaceId),
    fetchPage: (cursor) => workspaceDetailService.membersPage(token, workspaceId, cursor),
    enabled: enabled && token !== '' && workspaceId !== '',
  })
}

export function useWorkspaceInvitesList(workspaceId: string, enabled: boolean) {
  const token = useAuthSessionStore((state) => state.token)
  return usePageList({
    queryKey: workspaceDetailKeys.invites(token, workspaceId),
    fetchPage: (cursor) => workspaceDetailService.invitesPage(token, workspaceId, cursor),
    enabled: enabled && token !== '' && workspaceId !== '',
  })
}
