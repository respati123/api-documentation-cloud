import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNoticeStore } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import { workspacesKeys } from '@/features/workspaces'
import { readErrorMessage } from '@/shared/utils/error-message'
import { ACTIVITY_TEXT } from '../constants/activity-text.constants'
import { SETTINGS_TEXT } from '../constants/settings-text.constants'
import { TEAM_TEXT } from '../constants/team-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'
import { workspaceDetailKeys } from './workspace-detail.keys'

export type MemberRole = 'editor' | 'viewer'

export function useWorkspaceActionsViewModel(workspaceId: string, onLeaveWorkspace: () => void) {
  const { t } = useTranslation()
  const token = useAuthSessionStore((state) => state.token)
  const userId = useAuthSessionStore((state) => state.userId)
  const queryClient = useQueryClient()
  const showNotice = useNoticeStore((state) => state.show)

  const refreshDetail = () => queryClient.invalidateQueries({ queryKey: workspaceDetailKeys.all })
  const refreshWorkspaces = () => queryClient.invalidateQueries({ queryKey: workspacesKeys.all })
  const failure = (error: unknown, fallback: string) => showNotice({ kind: 'error', message: readErrorMessage(error, t(fallback)) })

  const cancelInvite = useMutation({
    mutationFn: (inviteId: string) => workspaceDetailService.cancelInvite(token, workspaceId, inviteId),
    onSuccess: () => {
      showNotice({ kind: 'success', message: t(TEAM_TEXT.toast.cancelled) })
      void queryClient.invalidateQueries({ queryKey: workspaceDetailKeys.invites(token, workspaceId) })
    },
    onError: (error) => failure(error, TEAM_TEXT.toast.cancelFailed),
  })

  const changeRole = useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; email: string; role: MemberRole }) =>
      workspaceDetailService.changeMemberRole(token, workspaceId, memberId, role),
    onSuccess: (_result, variables) => {
      const roleLabel = t(variables.role === 'editor' ? TEAM_TEXT.roleEditor : TEAM_TEXT.roleViewer)
      showNotice({ kind: 'success', message: t(TEAM_TEXT.toast.roleChanged, { email: variables.email, role: roleLabel }) })
      void refreshDetail()
    },
    onError: (error) => failure(error, TEAM_TEXT.toast.roleFailed),
  })

  const removeMember = useMutation({
    mutationFn: ({ memberId }: { memberId: string; email: string; workspaceName: string }) =>
      workspaceDetailService.removeMember(token, workspaceId, memberId),
    onSuccess: (_result, variables) => {
      if (variables.memberId === userId) {
        void refreshWorkspaces()
        showNotice({ kind: 'success', message: t(TEAM_TEXT.toast.left, { name: variables.workspaceName }) })
        onLeaveWorkspace()
        return
      }
      showNotice({ kind: 'success', message: t(TEAM_TEXT.toast.removed, { email: variables.email }) })
      void refreshDetail()
    },
    onError: (error) => failure(error, TEAM_TEXT.toast.memberFailed),
  })

  const rename = useMutation({
    mutationFn: (name: string) => workspaceDetailService.rename(token, workspaceId, name),
    onSuccess: () => {
      showNotice({ kind: 'success', message: t(SETTINGS_TEXT.general.renamed) })
      void refreshWorkspaces()
      void refreshDetail()
    },
    onError: (error) => failure(error, SETTINGS_TEXT.general.renameFailed),
  })

  const deleteWorkspace = useMutation({
    mutationFn: (confirmName: string) => workspaceDetailService.delete(token, workspaceId, confirmName),
    onSuccess: (_result, confirmName) => {
      void refreshWorkspaces()
      queryClient.removeQueries({ queryKey: workspaceDetailKeys.all })
      showNotice({ kind: 'success', message: t(SETTINGS_TEXT.danger.deleted, { name: confirmName }) })
      onLeaveWorkspace()
    },
    onError: (error) => failure(error, SETTINGS_TEXT.danger.deleteFailed),
  })

  const restoreCommit = useMutation({
    mutationFn: (commitId: string) => workspaceDetailService.restoreCommit(token, workspaceId, commitId),
    onSuccess: () => {
      showNotice({ kind: 'success', message: t(ACTIVITY_TEXT.actions.restored) })
      void refreshDetail()
    },
    onError: (error) => failure(error, ACTIVITY_TEXT.actions.restoreFailed),
  })

  return {
    cancelInvite,
    changeRole,
    removeMember,
    rename,
    deleteWorkspace,
    restoreCommit,
    currentUserId: userId,
  }
}
