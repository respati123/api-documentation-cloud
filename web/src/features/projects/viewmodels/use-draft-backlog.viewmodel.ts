import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useAuthSessionStore } from '@/features/auth'
import { BACKLOG_TEXT, DRAFT_BACKLOG_TEXT } from '@/features/projects/constants/backlog-text.constants'
import { issuesService } from '@/features/projects/services/issues.service'
import { issueKeys } from '@/features/projects/viewmodels/issue-keys'
import { showToast } from '@/shared/toast/toast-manager'
import { readErrorMessage } from '@/shared/utils/error-message'

// Makes draft epics and stories from an approved PRD. The server refuses a PRD that is not approved or not current.
export function useDraftBacklogViewModel(workspaceId: string, projectId: string | undefined, canRun: boolean, onDone: () => void) {
  const { t } = useTranslation('planning')
  const token = useAuthSessionStore((state) => state.token)
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: (documentId: string) => issuesService.draftBacklog(token, workspaceId, projectId ?? '', documentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: issueKeys.all(workspaceId, projectId ?? '') })
      showToast({ kind: 'success', message: t(DRAFT_BACKLOG_TEXT.done) })
      onDone()
    },
  })

  return {
    canRun: canRun && Boolean(projectId),
    isRunning: create.isPending,
    error: create.error ? readErrorMessage(create.error, t(BACKLOG_TEXT.error)) : null,
    run: (documentId: string) => {
      if (canRun && projectId) create.mutate(documentId)
    },
  }
}
