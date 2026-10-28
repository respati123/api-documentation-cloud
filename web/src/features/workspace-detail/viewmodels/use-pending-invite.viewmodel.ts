import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { type AppRoute, useNoticeStore } from '@/features/app-shell'
import { useAuthSessionStore } from '@/features/auth'
import { workspacesKeys } from '@/features/workspaces'
import { readErrorMessage } from '@/shared/utils/error-message'
import { WORKSPACE_TEXT } from '../constants/workspace-detail-text.constants'
import { workspaceDetailService } from '../services/workspace-detail.service'

// The invite token comes from the URL that opened the portal. It is accepted once per page load.
export function usePendingInviteViewModel(navigate: (route: AppRoute, replace?: boolean) => void) {
  const { t } = useTranslation()
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const showNotice = useNoticeStore((state) => state.show)
  const [pendingToken, setPendingToken] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '')
  const attempted = useRef(false)

  const accept = useMutation({
    mutationFn: (inviteToken: string) => workspaceDetailService.acceptInvite(token, inviteToken),
    onSuccess: (workspace) => {
      setPendingToken('')
      showNotice({ kind: 'success', message: t(WORKSPACE_TEXT.invite.joined, { name: workspace.name }) })
      navigate({ page: 'workspace', workspaceId: workspace.id, tab: 'overview' }, true)
      void queryClient.invalidateQueries({ queryKey: workspacesKeys.all })
    },
    onError: (error) => showNotice({ kind: 'error', message: readErrorMessage(error, t(WORKSPACE_TEXT.invite.failed)) }),
  })
  const acceptInvite = accept.mutate

  useEffect(() => {
    if (!token || !pendingToken || attempted.current) return
    attempted.current = true
    showNotice({ kind: 'info', message: t(WORKSPACE_TEXT.invite.accepting) })
    acceptInvite(pendingToken)
  }, [token, pendingToken, acceptInvite, showNotice, t])

  return { pendingToken, hasPendingInvite: pendingToken !== '' }
}
